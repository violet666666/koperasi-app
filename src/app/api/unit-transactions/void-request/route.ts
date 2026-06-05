import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { createNotification, getNotificationRecipients } from "@/lib/notifications";
import { logAuditFromRequest } from "@/lib/audit-logger";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

// Unit type abbreviations for readable reference numbers
const UNIT_ABBR: Record<string, string> = {
    cuci_mobil: "CM",
    barbershop: "BB",
    playstation: "PS",
    play_station: "PS",
    fitness: "FT",
    laundry: "LN",
    resto_cafe: "RC",
    resto: "RC",
    toko: "TK",
    coffe_latar: "CL",
    simpan_pinjam: "SP",
    fotocopy: "FC",
    aset: "AS",
};

// Generate readable request number from original transaction number
function generateVoidRequestNo(originalTxNo: string): string {
    return `VOID-${originalTxNo}`;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { transactionNo, reason } = body;

        if (!transactionNo || !reason) {
            return NextResponse.json({ message: "transactionNo dan reason wajib diisi" }, { status: 400 });
        }

        const currentUserId = parseInt(session.user.id);
        if (isNaN(currentUserId)) {
            return NextResponse.json({ message: "Session user ID tidak valid." }, { status: 401 });
        }
        const isOperator = ["operator", "admin"].includes(session.user.role)
            || session.user.permissions?.includes("manage_all");
        const now = new Date();

        let branchIdToUse = session.user.branchId || 1;
        if (!session.user.branchId) {
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            if (headOffice) branchIdToUse = headOffice.id;
        }

        // 1. PENANGANAN TRANSAKSI TOKO (StoreSale)
        // StoreSale uses unit-specific prefixes: TK (Toko), RS (Resto), CF (Cafe LSP), PS (PlayStation),
        // CL (Coffe Latar), RC (Resto Cafe). Legacy: POS-, TS-, SL- (offline sync/legacy format).
        // Also UnitTransaction can use TK-/TS- prefixes for Potong Gaji.
        // We try StoreSale first; if not found, fall-through to UnitTransaction below.
        const STORE_SALE_PREFIXES = ["POS-", "TK-", "TS-", "RS-", "PS-", "CF-", "CL-", "RC-", "SL-"];
        const isStoreSaleCandidate = STORE_SALE_PREFIXES.some(p => String(transactionNo).startsWith(p));
        if (isStoreSaleCandidate) {
            const storeSale = await prisma.storeSale.findUnique({
                where: { saleNo: String(transactionNo) },
                include: { member: true, createdBy: true, items: true },
            });

            if (storeSale) {

            const metadata: any = storeSale.metadata ? (typeof storeSale.metadata === 'object' ? storeSale.metadata : JSON.parse(storeSale.metadata as string)) : {};
            if (metadata.isVoided) return NextResponse.json({ message: "Transaksi Toko ini sudah dibatalkan." }, { status: 409 });

            // FIX: Recovery untuk voidPending orphan — jika voidPending=true tapi tidak ada ApprovalRequest,
            // berarti void sebelumnya gagal di tengah jalan. Reset voidPending agar bisa diajukan ulang.
            if (metadata.voidPending) {
                const existingRequest = await prisma.approvalRequest.findUnique({
                    where: { requestNo: generateVoidRequestNo(storeSale.saleNo) },
                });
                if (!existingRequest) {
                    // Orphan state — reset voidPending
                    metadata.voidPending = false;
                    delete metadata.voidPendingReason;
                    delete metadata.voidRequestedById;
                    delete metadata.voidRequestedAt;
                    await prisma.storeSale.update({
                        where: { id: storeSale.id },
                        data: { metadata },
                    });
                } else if (existingRequest.status === "pending") {
                    return NextResponse.json({ message: "Permintaan void untuk transaksi ini sudah menunggu persetujuan Admin." }, { status: 409 });
                } else {
                    // ApprovalRequest already processed (approved/rejected) but voidPending flag not cleared
                    // This can happen if the reject path in void-approve didn't clear the flag
                    metadata.voidPending = false;
                    await prisma.storeSale.update({
                        where: { id: storeSale.id },
                        data: { metadata },
                    });
                }
            }

            // JALUR A: Operator/Superadmin → Void langsung (bypass approval)
            if (isOperator) {
                // FIX: Set timeout lebih lama untuk transaksi dengan banyak item
                // Default Prisma 5 detik, kita naikkan ke 30 detik
                await prisma.$transaction(async (tx) => {
                    // FIX: Atomic claim — prevent double-void race condition
                    const fresh = await tx.storeSale.findUnique({ where: { id: storeSale.id } });
                    const freshMeta: any = fresh?.metadata ? (typeof fresh.metadata === 'object' ? fresh.metadata : JSON.parse(fresh.metadata as string)) : {};
                    if (freshMeta.isVoided) throw new Error("ALREADY_VOIDED");

                    // Kembalikan Stok — FIX: Restore to stockGdg (warehouse) not stockToko.
                    // Original sale deducts stockToko first then stockGdg (spillover).
                    // Void should return items to warehouse (stockGdg) to prevent stockToko inflation.
                    for (const item of storeSale.items) {
                        const prod = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                        if (prod && !prod.isService) {
                            const isRacikan = prod.trackStock === false;
                            const qty = Math.abs(item.quantity);

                            if (isRacikan) {
                                // Racikan: restore ingredient stock instead of product stock
                                const recipes = await tx.productRecipe.findMany({
                                    where: { productId: prod.id, ingredientProductId: { not: null } },
                                });
                                for (const recipe of recipes) {
                                    if (!recipe.ingredientProductId) continue;
                                    const ingredient = await tx.storeProduct.findUnique({
                                        where: { id: recipe.ingredientProductId },
                                    });
                                    if (!ingredient) continue;
                                    const restoreQty = Math.ceil(Number(recipe.quantity) * qty);
                                    const newGdg = ingredient.stockGdg + restoreQty;
                                    const newStock = ingredient.stockToko + newGdg;
                                    await tx.storeProduct.update({
                                        where: { id: ingredient.id },
                                        data: { stockGdg: newGdg, stock: newStock },
                                    });
                                    await tx.storeStockMovement.create({
                                        data: {
                                            productId: ingredient.id,
                                            type: "in",
                                            quantity: restoreQty,
                                            reference: `VOID ${storeSale.saleNo}`,
                                            notes: `Pengembalian bahan baku (void racikan)`,
                                            operatorId: currentUserId,
                                        },
                                    });
                                }
                            } else {
                                // Retail: restore product stock (existing behavior)
                                const newStockGdg = prod.stockGdg + qty;
                                const newStock = prod.stockToko + newStockGdg;

                                await tx.storeProduct.update({
                                    where: { id: item.productId },
                                    data: {
                                        stockGdg: newStockGdg,
                                        stock: newStock,
                                    },
                                });

                                await tx.storeStockMovement.create({
                                    data: {
                                        productId: item.productId,
                                        type: "in",
                                        quantity: qty,
                                        reference: `VOID ${storeSale.saleNo}`,
                                        notes: `Pengembalian stok (void operator)`,
                                        operatorId: currentUserId,
                                    },
                                });
                            }
                        }
                    }

                    // Tandai sebagai voided
                    metadata.isVoided = true;
                    metadata.voidPending = false;
                    metadata.voidReason = reason;
                    metadata.voidedById = currentUserId;
                    metadata.voidedAt = now.toISOString();

                    await tx.storeSale.update({
                        where: { id: storeSale.id },
                        data: { metadata: metadata },
                    });

                    // ── Reverse side-effects keuangan (atomic, inside transaction) ──

                    // 1. Reverse Journal (jika ada)
                    if (storeSale.journalId) {
                        const originalJournal = await tx.journal.findUnique({
                            where: { id: storeSale.journalId },
                            include: { lines: true },
                        });
                        if (originalJournal) {
                            const reverseJournalNo = `RV-${Date.now().toString(36).toUpperCase()}`;
                            const reverseJournal = await tx.journal.create({
                                data: {
                                    journalNo: reverseJournalNo,
                                    branchId: originalJournal.branchId,
                                    transactionDate: now,
                                    description: `[VOID] Pembalik ${originalJournal.journalNo} - ${storeSale.saleNo}`,
                                    sourceType: "store_sale_void",
                                    periodId: originalJournal.periodId,
                                    isPosted: true,
                                    createdById: currentUserId,
                                },
                            });
                            if (originalJournal.lines.length > 0) {
                                await tx.journalLine.createMany({
                                    data: originalJournal.lines.map((line: any) => ({
                                        journalId: reverseJournal.id,
                                        accountId: line.accountId,
                                        debit: Number(line.credit),
                                        credit: Number(line.debit),
                                        description: `[VOID] ${line.description || ""}`,
                                    })),
                                });
                            }
                        }
                    }

                    // 2. Reverse CashBankTransaction (tunai/QRIS) — atomic balance update
                    if (storeSale.paymentMethod === "cash" || storeSale.paymentMethod === "qris") {
                        const originalCashTx = await tx.cashBankTransaction.findFirst({
                            where: { description: { contains: storeSale.saleNo } },
                        });
                        if (originalCashTx) {
                            const voidAmount = Number(storeSale.totalAmount);
                            // FIX: Atomic decrement FIRST to prevent TOCTOU race condition
                            const updatedAccount = await tx.cashBankAccount.update({
                                where: { id: originalCashTx.accountId },
                                data: { currentBalance: { decrement: voidAmount } },
                            });
                            const balanceBefore = Number(updatedAccount.currentBalance) + voidAmount;

                            const voidCashTx = await tx.cashBankTransaction.create({
                                data: {
                                    transactionNo: `TK-VOID-${Date.now().toString(36).toUpperCase()}`,
                                    accountId: originalCashTx.accountId,
                                    branchId: originalCashTx.branchId,
                                    type: "out",
                                    category: "void_penjualan_toko",
                                    amount: voidAmount,
                                    balanceBefore,
                                    balanceAfter: Number(updatedAccount.currentBalance),
                                    unitType: storeSale.unitType || "toko",
                                    description: `[VOID] Pembatalan ${storeSale.saleNo}`,
                                    transactionDate: now,
                                    createdById: currentUserId,
                                },
                            });

                            // FIX: Adjust running balance chain for subsequent transactions
                            const balanceImpact = -voidAmount;
                            await tx.$executeRaw`
                                UPDATE "cash_bank_transactions"
                                SET
                                    "balance_before" = "balance_before" + ${balanceImpact},
                                    "balance_after" = "balance_after" + ${balanceImpact}
                                WHERE "account_id" = ${originalCashTx.accountId}
                                  AND (
                                      "transaction_date" > ${now}
                                      OR ("transaction_date" = ${now} AND "id" > ${voidCashTx.id})
                                  )
                            `;
                        }
                    }

                    // 3. Void linked UnitTransaction for salary_cut (piutang)
                    if (storeSale.paymentMethod === "salary_cut") {
                        await tx.unitTransaction.updateMany({
                            where: {
                                description: { contains: storeSale.saleNo },
                                status: { in: ["completed", "pending_void"] },
                            },
                            data: { status: "voided", isPaid: false },
                        });
                    }
                }, { timeout: 30000 }); // FIX: 30 detik timeout untuk transaksi dengan banyak item

                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Toko",
                        description: `VOID transaksi toko ${storeSale.saleNo} oleh Operator — ${reason}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        oldData: { saleNo: storeSale.saleNo, totalAmount: Number(storeSale.totalAmount), paymentMethod: storeSale.paymentMethod },
                        metadata: { voidReason: reason, itemCount: storeSale.items.length, memberName: storeSale.member?.name || "Walk-in" },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }

                return NextResponse.json({
                    message: "Transaksi Toko dibatalkan oleh Operator. Stok telah dikembalikan.",
                    data: { transactionNo: storeSale.saleNo, status: "voided" },
                });
            }

            // JALUR B: Kasir/Admin Unit → Buat ApprovalRequest pending
            // FIX: Wrap dalam $transaction agar StoreSale update dan ApprovalRequest create atomic
            await prisma.$transaction(async (tx) => {
                // Tandai transaksi bahwa ada permintaan void yang menunggu
                metadata.voidPending = true;
                metadata.voidPendingReason = reason;
                metadata.voidRequestedById = currentUserId;
                metadata.voidRequestedAt = now.toISOString();

                await tx.storeSale.update({
                    where: { id: storeSale.id },
                    data: { metadata: metadata },
                });

                // Buat entri approval request — requestNo = VOID-{saleNo} agar mudah dilacak
                const requestNo = generateVoidRequestNo(storeSale.saleNo);

                // Cek apakah requestNo sudah ada (dedup guard)
                const existing = await tx.approvalRequest.findUnique({ where: { requestNo } });
                if (existing) {
                    throw new Error(`ApprovalRequest dengan nomor ${requestNo} sudah ada (status: ${existing.status}).`);
                }

                await tx.approvalRequest.create({
                    data: {
                        requestNo,
                        type: "void_store_sale",
                        referenceType: "store_sale",
                        referenceId: storeSale.id,
                        branchId: branchIdToUse,
                        amount: storeSale.totalAmount,
                        description: `Pembatalan Transaksi Toko [${storeSale.saleNo}] — ${reason}`,
                        requestedById: currentUserId,
                        requestedAt: now,
                        status: "pending",
                        metadata: {
                            saleId: storeSale.id,
                            saleNo: storeSale.saleNo,
                            unitType: storeSale.unitType || "toko",
                            voidReason: reason,
                            itemCount: storeSale.items.length,
                            memberName: storeSale.member?.name || (storeSale as any).customerName || "Walk-in",
                            memberNrp: storeSale.member?.nrp || "-",
                            kasirName: storeSale.createdBy?.name || "Kasir",
                        },
                    },
                });
            }, { timeout: 15000 });

            // Notify admins about void request
            try {
                const adminIds = await getNotificationRecipients(storeSale.unitType);
                if (adminIds.length > 0) {
                    await createNotification({
                        userId: adminIds,
                        type: "void_request",
                        title: "Permintaan Void",
                        message: `Kasir mengajukan void untuk ${storeSale.saleNo}${reason ? `: ${reason}` : ""}`,
                        data: { saleId: storeSale.id, saleNo: storeSale.saleNo, unitType: storeSale.unitType },
                    });
                }
            } catch (e) { /* notification failure must not break response */ }

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "UPDATE",
                    module: "Toko",
                    description: `VOID REQUEST transaksi toko ${storeSale.saleNo} oleh ${session.user.name} — ${reason}`,
                    targetId: storeSale.id,
                    targetType: "StoreSale",
                    metadata: { voidReason: reason, status: "pending_approval", itemCount: storeSale.items.length },
                    unitType: storeSale.unitType || "toko",
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                message: `Permintaan void untuk transaksi ${transactionNo} telah dikirim ke Admin. Menunggu persetujuan.`,
                data: { transactionNo: storeSale.saleNo, status: "pending_void" },
            });
            } // end if (storeSale)
            // StoreSale tidak ditemukan dengan prefix ini → fall-through ke UnitTransaction di bawah
        }

        // 2. PENANGANAN UNIT TRANSACTION (termasuk Potong Gaji dengan prefix TK-, CM-, BB-, dsb.)
        const transaction = await prisma.unitTransaction.findUnique({
            where: { transactionNo: String(transactionNo) },
            include: { member: { select: { id: true, name: true, nrp: true } }, createdBy: { select: { id: true, name: true } } },
        });

        if (!transaction) {
            // FALLBACK: Try StoreSale regardless of prefix — handles legacy/unknown prefixes
            const fallbackSale = await prisma.storeSale.findUnique({
                where: { saleNo: String(transactionNo) },
                include: { member: true, createdBy: true, items: true },
            });
            if (fallbackSale) {
                // Re-enter the StoreSale void logic by re-dispatching
                // For simplicity, return a descriptive error so user retries via StoreSale path
                // after the prefix list is updated. But since we already added the prefix,
                // this fallback mainly catches edge cases.
                const fbMeta: any = fallbackSale.metadata ? (typeof fallbackSale.metadata === 'object' ? fallbackSale.metadata : JSON.parse(fallbackSale.metadata as string)) : {};
                if (fbMeta.isVoided) return NextResponse.json({ message: "Transaksi ini sudah dibatalkan." }, { status: 409 });

                if (isOperator) {
                    // Operator void flow — same logic as above but for fallback sale
                    await prisma.$transaction(async (tx) => {
                        const fresh = await tx.storeSale.findUnique({ where: { id: fallbackSale.id } });
                        const freshMeta: any = fresh?.metadata ? (typeof fresh.metadata === 'object' ? fresh.metadata : JSON.parse(fresh.metadata as string)) : {};
                        if (freshMeta.isVoided) throw new Error("ALREADY_VOIDED");

                        // Restore stock
                        for (const item of fallbackSale.items) {
                            const prod = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                            if (prod && !prod.isService) {
                                const qty = Math.abs(item.quantity);
                                const newStockGdg = prod.stockGdg + qty;
                                const newStock = prod.stockToko + newStockGdg;
                                await tx.storeProduct.update({
                                    where: { id: item.productId },
                                    data: { stockGdg: newStockGdg, stock: newStock },
                                });
                                await tx.storeStockMovement.create({
                                    data: {
                                        productId: item.productId,
                                        type: "in",
                                        quantity: qty,
                                        reference: `VOID ${fallbackSale.saleNo}`,
                                        notes: `Pengembalian stok (void fallback)`,
                                        operatorId: currentUserId,
                                    },
                                });
                            }
                        }

                        fbMeta.isVoided = true;
                        fbMeta.voidReason = reason;
                        fbMeta.voidedById = currentUserId;
                        fbMeta.voidedAt = now.toISOString();

                        await tx.storeSale.update({
                            where: { id: fallbackSale.id },
                            data: { metadata: fbMeta },
                        });

                        // Reverse CashBankTransaction if cash/QRIS
                        if (fallbackSale.paymentMethod === "cash" || fallbackSale.paymentMethod === "qris") {
                            const originalCashTx = await tx.cashBankTransaction.findFirst({
                                where: { description: { contains: fallbackSale.saleNo } },
                            });
                            if (originalCashTx) {
                                const voidAmount = Number(fallbackSale.totalAmount);
                                const updatedAccount = await tx.cashBankAccount.update({
                                    where: { id: originalCashTx.accountId },
                                    data: { currentBalance: { decrement: voidAmount } },
                                });
                                const balanceBefore = Number(updatedAccount.currentBalance) + voidAmount;
                                await tx.cashBankTransaction.create({
                                    data: {
                                        transactionNo: `TK-VOID-${Date.now().toString(36).toUpperCase()}`,
                                        accountId: originalCashTx.accountId,
                                        branchId: originalCashTx.branchId,
                                        type: "out",
                                        category: "void_penjualan_toko",
                                        amount: voidAmount,
                                        balanceBefore,
                                        balanceAfter: Number(updatedAccount.currentBalance),
                                        unitType: fallbackSale.unitType || "toko",
                                        description: `[VOID] Pembatalan ${fallbackSale.saleNo}`,
                                        transactionDate: now,
                                        createdById: currentUserId,
                                    },
                                });
                            }
                        }

                        // Reverse journal if exists
                        if (fallbackSale.journalId) {
                            const originalJournal = await tx.journal.findUnique({
                                where: { id: fallbackSale.journalId },
                                include: { lines: true },
                            });
                            if (originalJournal) {
                                const reverseJournal = await tx.journal.create({
                                    data: {
                                        journalNo: `RV-${Date.now().toString(36).toUpperCase()}`,
                                        branchId: originalJournal.branchId,
                                        transactionDate: now,
                                        description: `[VOID] Pembalik ${originalJournal.journalNo} - ${fallbackSale.saleNo}`,
                                        sourceType: "store_sale_void",
                                        periodId: originalJournal.periodId,
                                        isPosted: true,
                                        createdById: currentUserId,
                                    },
                                });
                                if (originalJournal.lines.length > 0) {
                                    await tx.journalLine.createMany({
                                        data: originalJournal.lines.map((line: any) => ({
                                            journalId: reverseJournal.id,
                                            accountId: line.accountId,
                                            debit: Number(line.credit),
                                            credit: Number(line.debit),
                                            description: `[VOID] ${line.description || ""}`,
                                        })),
                                    });
                                }
                            }
                        }
                    }, { timeout: 30000 });

                    try {
                        await logAuditFromRequest(request, session, {
                            action: "DELETE", module: "Toko",
                            description: `VOID (fallback) transaksi ${fallbackSale.saleNo} oleh Operator — ${reason}`,
                            targetId: fallbackSale.id, targetType: "StoreSale",
                            oldData: { saleNo: fallbackSale.saleNo, totalAmount: Number(fallbackSale.totalAmount) },
                            unitType: fallbackSale.unitType || "toko",
                        });
                    } catch (e) { /* audit failure non-critical */ }

                    return NextResponse.json({
                        message: "Transaksi berhasil dibatalkan. Stok telah dikembalikan.",
                        data: { transactionNo: fallbackSale.saleNo, status: "voided" },
                    });
                } else {
                    // Non-operator: create approval request
                    await prisma.$transaction(async (tx) => {
                        fbMeta.voidPending = true;
                        fbMeta.voidPendingReason = reason;
                        fbMeta.voidRequestedById = currentUserId;
                        fbMeta.voidRequestedAt = now.toISOString();
                        await tx.storeSale.update({
                            where: { id: fallbackSale.id },
                            data: { metadata: fbMeta },
                        });
                        const requestNo = generateVoidRequestNo(fallbackSale.saleNo);
                        const existing = await tx.approvalRequest.findUnique({ where: { requestNo } });
                        if (existing) throw new Error(`ApprovalRequest ${requestNo} sudah ada.`);
                        await tx.approvalRequest.create({
                            data: {
                                requestNo,
                                type: "void_store_sale",
                                referenceType: "store_sale",
                                referenceId: fallbackSale.id,
                                branchId: branchIdToUse,
                                amount: fallbackSale.totalAmount,
                                description: `Pembatalan Transaksi [${fallbackSale.saleNo}] — ${reason}`,
                                requestedById: currentUserId,
                                requestedAt: now,
                                status: "pending",
                                metadata: {
                                    saleId: fallbackSale.id,
                                    saleNo: fallbackSale.saleNo,
                                    unitType: fallbackSale.unitType || "toko",
                                    voidReason: reason,
                                    itemCount: fallbackSale.items.length,
                                    memberName: fallbackSale.member?.name || "Walk-in",
                                },
                            },
                        });
                    }, { timeout: 15000 });

                    return NextResponse.json({
                        message: `Permintaan void untuk transaksi ${transactionNo} telah dikirim ke Admin.`,
                        data: { transactionNo: fallbackSale.saleNo, status: "pending_void" },
                    });
                }
            }

            return NextResponse.json({ message: `Transaksi ${transactionNo} tidak ditemukan.` }, { status: 404 });
        }
        if (transaction.status !== "completed") return NextResponse.json({ message: `Status transaksi saat ini sudah berstatus: ${transaction.status}` }, { status: 409 });
        if (session.user.role === "kasir" && transaction.createdById !== currentUserId) {
            return NextResponse.json({ message: "Kasir hanya dapat mengajukan void untuk transaksi miliknya sendiri." }, { status: 403 });
        }
        // FIX: Unit type isolation for kasir
        if (session.user.role === "kasir") {
            const userUnitType = (session.user as Record<string, unknown>).unitType as string | undefined;
            if (userUnitType && !isSameUnit(transaction.unitType, userUnitType)) {
                return NextResponse.json(
                    { message: "Anda tidak memiliki akses ke unit ini." },
                    { status: 403 }
                );
            }
        }

        // AUTO-APPROVE VOID JIKA OPERATOR atau ADMIN PUSAT
        if (isOperator) {
            const contraNo = `CE-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
             // Hash keamanan untuk contra-entry
            const hashInput = `${transaction.member?.nrp || "UMUM"}-${-Number(transaction.amount)}-${contraNo}-${now.toISOString()}`;
            const securityHash = crypto.createHash("sha256").update(hashInput).digest("hex");

            await prisma.$transaction(async (tx) => {
                // FIX: Atomic claim — prevent double-void race condition
                const claim = await tx.unitTransaction.updateMany({
                    where: { id: transaction.id, status: "completed" },
                    data: { status: "voided", voidReason: reason, voidedById: currentUserId, voidedAt: now },
                });
                if (claim.count === 0) throw new Error("ALREADY_VOIDED");

                // 1. Buat Contra-Entry (nilai negatif)
                await tx.unitTransaction.create({
                    data: {
                        transactionNo: contraNo,
                        memberId: transaction.memberId,
                        unitType: transaction.unitType,
                        description: `[VOID] Pembatalan ${transaction.transactionNo} — ${transaction.description}`,
                        amount: -Number(transaction.amount),
                        loanAmount: -Number(transaction.loanAmount),
                        transactionDate: now,
                        paymentMethod: transaction.paymentMethod,
                        isPaid: true,
                        paidDate: now,
                        notes: `Contra-Entry (Bypass Persetujuan Admin). Alasan: ${reason}`,
                        status: "voided",
                        voidRef: transaction.transactionNo,
                        voidReason: reason,
                        voidedById: currentUserId,
                        voidedAt: now,
                        securityHash,
                        createdById: currentUserId,
                    },
                });

                // 3. Reverse Journal entry jika ada
                const originalJournal = await tx.journal.findFirst({
                    where: { description: { contains: transaction.transactionNo }, sourceType: "unit_transaction" },
                    include: { lines: true },
                });
                if (originalJournal) {
                    const headOffice = await tx.branch.findFirst({ where: { isHeadOffice: true } });
                    const currentPeriod = await tx.fiscalPeriod.findFirst({
                        where: { status: "open", startDate: { lte: now }, endDate: { gte: now } },
                    });
                    if (headOffice && currentPeriod) {
                        const reverseJournal = await tx.journal.create({
                            data: {
                                journalNo: `RV-${Date.now().toString(36).toUpperCase()}`,
                                branchId: headOffice.id,
                                transactionDate: now,
                                description: `[VOID] Pembalik ${originalJournal.journalNo} - ${transaction.transactionNo}`,
                                sourceType: "unit_void",
                                periodId: currentPeriod.id,
                                isPosted: true,
                                createdById: currentUserId,
                            },
                        });
                        if (originalJournal.lines.length > 0) {
                            await tx.journalLine.createMany({
                                data: originalJournal.lines.map((line: any) => ({
                                    journalId: reverseJournal.id,
                                    accountId: line.accountId,
                                    debit: Number(line.credit),
                                    credit: Number(line.debit),
                                    description: `[VOID] ${line.description || ""}`,
                                })),
                            });
                        }
                    }
                }

                // 4. Reverse Cash/Bank untuk transaksi cash/QRIS
                if (transaction.paymentMethod === "cash" || transaction.paymentMethod === "qris") {
                    const originalCashTx = await tx.cashBankTransaction.findFirst({
                        where: { description: { contains: transaction.transactionNo } },
                    });
                    if (originalCashTx) {
                        const voidAmount = Number(transaction.amount);
                        // Atomic decrement
                        const updatedAccount = await tx.cashBankAccount.update({
                            where: { id: originalCashTx.accountId },
                            data: { currentBalance: { decrement: voidAmount } },
                        });
                        const balanceBefore = Number(updatedAccount.currentBalance) + voidAmount;

                        const voidCashTx = await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `VOID-${UNIT_ABBR[transaction.unitType] || "UT"}-${Date.now().toString(36).toUpperCase()}`,
                                accountId: originalCashTx.accountId,
                                branchId: originalCashTx.branchId,
                                type: "out",
                                category: "void_unit_transaction",
                                amount: voidAmount,
                                balanceBefore,
                                balanceAfter: Number(updatedAccount.currentBalance),
                                unitType: transaction.unitType,
                                description: `[VOID] Pembatalan ${transaction.transactionNo}`,
                                transactionDate: now,
                                createdById: currentUserId,
                            },
                        });

                        // FIX: Adjust running balance chain for subsequent transactions
                        const balanceImpact = -voidAmount;
                        await tx.$executeRaw`
                            UPDATE "cash_bank_transactions"
                            SET
                                "balance_before" = "balance_before" + ${balanceImpact},
                                "balance_after" = "balance_after" + ${balanceImpact}
                            WHERE "account_id" = ${originalCashTx.accountId}
                              AND (
                                  "transaction_date" > ${now}
                                  OR ("transaction_date" = ${now} AND "id" > ${voidCashTx.id})
                              )
                        `;
                    }
                }
            }, { timeout: 30000 });

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "DELETE",
                    module: "Unit_Layanan",
                    description: `VOID transaksi ${transaction.transactionNo} (${transaction.unitType}) oleh Operator — ${reason}`,
                    targetId: transaction.id,
                    targetType: "UnitTransaction",
                    oldData: { transactionNo: transaction.transactionNo, amount: Number(transaction.amount), unitType: transaction.unitType },
                    metadata: { voidReason: reason, contraEntryNo: contraNo },
                    unitType: transaction.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                message: "Permintaan Void berhasil disetujui secara otomatis (Bypass Admin).",
                data: { transactionNo: transaction.transactionNo, status: "voided" }
            }, { status: 200 });
        }

        // KASIR BIASA -> PENDING VOID
        const [updatedTx, approvalReq] = await prisma.$transaction([
            prisma.unitTransaction.update({
                where: { id: transaction.id },
                data: { status: "pending_void", voidReason: reason, voidRequestedById: currentUserId, voidRequestedAt: now },
            }),
            prisma.approvalRequest.create({
                data: {
                    requestNo: generateVoidRequestNo(transaction.transactionNo),
                    type: "unit_void",
                    referenceType: "unit_transaction",
                    referenceId: transaction.id,
                    branchId: branchIdToUse,
                    amount: transaction.amount,
                    description: `Pembatalan Transaksi [${transactionNo}] dari Unit ${transaction.unitType.toUpperCase()} — ${reason}`,
                    metadata: {
                        transactionNo: transaction.transactionNo,
                        unitType: transaction.unitType,
                        memberName: transaction.member?.name || "-",
                        memberNrp: transaction.member?.nrp || "-",
                        originalAmount: Number(transaction.amount),
                        kasirName: transaction.createdBy?.name || "-",
                        voidReason: reason,
                        vehiclePlate: transaction.notes?.match(/\[PLAT:(.*?)\]/)?.[1]?.trim() || null,
                    },
                    requestedById: currentUserId,
                    requestedAt: now,
                    status: "pending",
                },
            }),
        ]);

        // Notify admins about unit void request
        try {
            const adminIds = await getNotificationRecipients(transaction.unitType);
            if (adminIds.length > 0) {
                await createNotification({
                    userId: adminIds,
                    type: "void_request",
                    title: "Permintaan Void",
                    message: `Void diajukan untuk ${transaction.transactionNo}${reason ? `: ${reason}` : ""}`,
                    data: { transactionId: transaction.id, transactionNo: transaction.transactionNo, unitType: transaction.unitType },
                });
            }
        } catch (e) { /* notification failure must not break response */ }

        // Audit log
        try {
            await logAuditFromRequest(request, session, {
                action: "UPDATE",
                module: "Unit_Layanan",
                description: `VOID REQUEST transaksi ${transaction.transactionNo} (${transaction.unitType}) oleh ${session.user.name} — ${reason}`,
                targetId: transaction.id,
                targetType: "UnitTransaction",
                metadata: { voidReason: reason, status: "pending_approval", unitType: transaction.unitType },
                unitType: transaction.unitType,
            });
        } catch (e) { /* audit failure must not break response */ }

        return NextResponse.json({
            message: "Permintaan void berhasil diajukan. Menunggu persetujuan Admin Unit.",
            data: { transactionNo: updatedTx.transactionNo, status: updatedTx.status, approvalRequestNo: approvalReq.requestNo },
        }, { status: 201 });

    } catch (error: any) {
        console.error("POST /api/unit-transactions/void-request error:", error);

        // FIX: Return actual error message instead of generic message
        let errorMessage = "Gagal mengajukan void transaksi";
        let statusCode = 500;

        if (error?.message === "ALREADY_VOIDED") {
            return NextResponse.json({ message: "Transaksi sudah dibatalkan sebelumnya." }, { status: 409 });
        } else if (error?.code === "P2024") {
            // Prisma transaction timeout
            errorMessage = "Transaksi timeout — terlalu banyak item untuk diproses. Coba lagi atau hubungi administrator.";
            statusCode = 504;
        } else if (error?.code === "P2002") {
            // Unique constraint violation
            const target = error?.meta?.target as string[] | undefined;
            errorMessage = `Data duplikat terdeteksi (${target?.join(", ") || "unknown"}). Kemungkinan void sudah pernah diajukan sebelumnya.`;
            statusCode = 409;
        } else if (error?.code === "P2003") {
            // Foreign key constraint
            errorMessage = "Referensi data tidak valid. Kemungkinan data terkait sudah dihapus.";
            statusCode = 400;
        } else if (error?.message && process.env.NODE_ENV === "development") {
            // Only expose raw error messages in development
            errorMessage = error.message.length > 200
                ? error.message.substring(0, 200) + "..."
                : error.message;
        }

        return NextResponse.json({ message: errorMessage }, { status: statusCode });
    }
}
