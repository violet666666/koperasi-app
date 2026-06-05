import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { sendPushNotification } from "@/lib/expo-push";
import { logAuditFromRequest } from "@/lib/audit-logger";
import { isSameUnit } from "@/lib/unit-aliases";
export const dynamic = "force-dynamic";

// Transaction timeout config — default Prisma interactive tx timeout = 5s
// which is too short for void operations (stock restore + journal reverse + cash bank reverse)
// Monorepo POS dengan banyak unit + Neon DB cross-region butuh waktu lebih lama
const TX_OPTIONS = { maxWait: 30000, timeout: 60000 };

/**
 * POST /api/unit-transactions/void-approve
 * Admin Unit / Operator menyetujui atau menolak permintaan void.
 *
 * Jika APPROVE:
 *   1. Buat baris Contra-Entry baru di unit_transactions (nilai minus / negatif)
 *   2. Update transaksi asli: status = 'voided'
 *   3. Update ApprovalRequest: status = 'approved'
 *   → Sisa limit anggota otomatis pulih karena SUM hanya ambil status != 'voided'
 *
 * Jika REJECT:
 *   1. Update transaksi asli kembali ke: status = 'completed'
 *   2. Update ApprovalRequest: status = 'rejected'
 *
 * Body: { approvalRequestNo: string, action: 'approved' | 'rejected', notes?: string }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // Hanya Admin Unit dan Operator yang bisa approve
        const allowedRoles = ["operator", "admin", "admin_unit"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json(
                { message: "Anda tidak memiliki izin untuk menyetujui/menolak void." },
                { status: 403 }
            );
        }

        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");
        const isUnitAdmin = roleName === "admin" && userUnitType && userUnitType !== "simpan_pinjam";

        const body = await request.json();
        const { approvalRequestNo, action, notes } = body;

        if (!approvalRequestNo || !action) {
            return NextResponse.json(
                { message: "approvalRequestNo dan action wajib diisi" },
                { status: 400 }
            );
        }

        if (!["approved", "rejected"].includes(action)) {
            return NextResponse.json(
                { message: "action harus 'approved' atau 'rejected'" },
                { status: 400 }
            );
        }

        // Cari ApprovalRequest
        const approvalReq = await prisma.approvalRequest.findUnique({
            where: { requestNo: String(approvalRequestNo) },
        });

        if (!approvalReq) {
            return NextResponse.json(
                { message: `ApprovalRequest ${approvalRequestNo} tidak ditemukan.` },
                { status: 404 }
            );
        }

        if (approvalReq.status !== "pending") {
            return NextResponse.json(
                { message: `Request ini sudah diproses sebelumnya (status: ${approvalReq.status}).` },
                { status: 409 }
            );
        }

        // ── Unit Scope Validation: Admin unit hanya bisa approve void dari unit mereka ──
        if (isUnitAdmin) {
            const reqMeta: any = typeof approvalReq.metadata === 'string'
                ? JSON.parse(approvalReq.metadata)
                : approvalReq.metadata || {};
            if (reqMeta.unitType && !isSameUnit(reqMeta.unitType, userUnitType)) {
                return NextResponse.json(
                    { message: `Anda (admin ${userUnitType}) tidak memiliki izin untuk memproses void dari unit ${reqMeta.unitType}.` },
                    { status: 403 }
                );
            }
        }

        const currentUserId = parseInt(session.user.id);
        const now = new Date();

        // ── Atomic guard: Claim this request exclusively ──────────────
        // NOTE: For StoreSale voids, we claim inside the transaction below.
        // For UnitTransaction voids, we claim here (legacy behavior).
        let claimResult = { count: 0 };

        // ================================================================
        // JALUR 1: Void untuk TRANSAKSI TOKO (StoreSale)
        // ================================================================
        if (approvalReq.type === "void_store_sale") {
            const storeSale = await prisma.storeSale.findUnique({
                where: { id: approvalReq.referenceId },
                include: { items: true },
            });

            if (!storeSale) {
                return NextResponse.json({ message: "Transaksi Toko asli tidak ditemukan." }, { status: 404 });
            }

            if (action === "approved") {
                const metadata: any = storeSale.metadata
                    ? (typeof storeSale.metadata === "object" ? storeSale.metadata : JSON.parse(storeSale.metadata as string))
                    : {};

                // Single atomic transaction: claim approval + restore stock + reverse financials + update metadata
                await prisma.$transaction(async (tx) => {
                    // Atomic guard inside transaction
                    const claim = await tx.approvalRequest.updateMany({
                        where: { id: approvalReq.id, status: "pending" },
                        data: { status: "approved" },
                    });
                    if (claim.count === 0) {
                        throw new Error("ALREADY_PROCESSED");
                    }

                    // Kembalikan stok — FIX: Restore to stockGdg (warehouse) not stockToko.
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
                                            notes: `Pengembalian bahan baku (void disetujui)`,
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
                                        notes: `Pengembalian stok (void disetujui)`,
                                        operatorId: currentUserId,
                                    },
                                });
                            }
                        }
                    }

                    // Update metadata StoreSale: tandai voided, hapus voidPending
                    metadata.isVoided = true;
                    metadata.voidPending = false;
                    metadata.voidReason = metadata.voidPendingReason || "Void disetujui oleh admin";
                    metadata.voidApprovedById = currentUserId;
                    metadata.voidApprovedAt = now.toISOString();

                    await tx.storeSale.update({
                        where: { id: storeSale.id },
                        data: { metadata },
                    });

                    await tx.approvalRequest.update({
                        where: { id: approvalReq.id },
                        data: { approvedById: currentUserId, approvedAt: now },
                    });

                    // ── Reverse side-effects keuangan (inside transaction) ──

                    // 1. Reverse Journal
                    if (storeSale.journalId) {
                        const originalJournal = await tx.journal.findUnique({
                            where: { id: storeSale.journalId },
                            include: { lines: true },
                        });
                        if (originalJournal) {
                            const reverseJournal = await tx.journal.create({
                                data: {
                                    journalNo: `RV-${Date.now().toString(36).toUpperCase()}`,
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

                    // 2. Reverse CashBankTransaction (tunai/QRIS) — atomic decrement
                    if (storeSale.paymentMethod === "cash" || storeSale.paymentMethod === "qris") {
                        const originalCashTx = await tx.cashBankTransaction.findFirst({
                            where: { description: { contains: storeSale.saleNo } },
                        });
                        if (originalCashTx) {
                            const voidAmount = Number(storeSale.totalAmount);
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

                            // Adjust running balance chain for subsequent transactions
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
                }, TX_OPTIONS);

                // Kirim notifikasi ke kasir pemohon
                try {
                    const requester = await prisma.user.findUnique({ where: { id: approvalReq.requestedById }, select: { fcmToken: true } });
                    if (requester?.fcmToken) {
                        await sendPushNotification({
                            to: requester.fcmToken,
                            title: "✅ Void Disetujui",
                            body: `Permintaan void untuk transaksi toko ${storeSale.saleNo} telah disetujui.`,
                            data: { screen: "RiwayatKasir" }
                        });
                    }
                } catch (e) { console.error("Push failed:", e); }

                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "DELETE",
                        module: "Toko",
                        description: `VOID APPROVE transaksi toko ${storeSale.saleNo} — ${metadata.voidPendingReason || notes || "Void disetujui"}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        metadata: { approvedBy: currentUserId, itemCount: storeSale.items.length },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }

                return NextResponse.json({
                    message: `Void Toko disetujui. Transaksi [${storeSale.saleNo}] dibatalkan dan stok telah dikembalikan.`,
                    data: { saleNo: storeSale.saleNo, action: "approved" },
                });
            } else {
                // REJECTED — hapus flag voidPending dari metadata
                const metadata: any = storeSale.metadata
                    ? (typeof storeSale.metadata === "object" ? storeSale.metadata : JSON.parse(storeSale.metadata as string))
                    : {};

                metadata.voidPending = false;

                await prisma.$transaction(async (tx) => {
                    // Atomic guard: claim this approval exclusively
                    const claim = await tx.approvalRequest.updateMany({
                        where: { id: approvalReq.id, status: "pending" },
                        data: { status: "rejected" },
                    });
                    if (claim.count === 0) {
                        throw new Error("ALREADY_PROCESSED");
                    }

                    await tx.storeSale.update({
                        where: { id: storeSale.id },
                        data: { metadata },
                    });
                    await tx.approvalRequest.update({
                        where: { id: approvalReq.id },
                        data: {
                            rejectedById: currentUserId,
                            rejectedAt: now,
                            rejectionReason: notes || "Ditolak oleh Admin Unit.",
                        },
                    });
                }, TX_OPTIONS);

                // Kirim notifikasi ke kasir pemohon
                try {
                    const requester = await prisma.user.findUnique({ where: { id: approvalReq.requestedById }, select: { fcmToken: true } });
                    if (requester?.fcmToken) {
                        await sendPushNotification({
                            to: requester.fcmToken,
                            title: "❌ Void Ditolak",
                            body: `Permintaan void untuk transaksi toko ${storeSale.saleNo} ditolak. Alasan: ${notes || "Ditolak admin"}`,
                            data: { screen: "RiwayatKasir" }
                        });
                    }
                } catch (e) { console.error("Push failed:", e); }

                // Audit log
                try {
                    await logAuditFromRequest(request, session, {
                        action: "REJECT",
                        module: "Toko",
                        description: `VOID REJECT transaksi toko ${storeSale.saleNo}${notes ? ` — ${notes}` : ""}`,
                        targetId: storeSale.id,
                        targetType: "StoreSale",
                        metadata: { rejectedBy: currentUserId, rejectionReason: notes },
                        unitType: storeSale.unitType || "toko",
                    });
                } catch (e) { /* audit failure must not break response */ }

                return NextResponse.json({
                    message: `Permintaan void ditolak. Transaksi Toko [${storeSale.saleNo}] tetap aktif.`,
                    data: { saleNo: storeSale.saleNo, action: "rejected" },
                });
            }
        }

        // ================================================================
        // JALUR 2: Void untuk UNIT TRANSACTION (Jasa Cepat)
        // ================================================================
        const originalTx = await prisma.unitTransaction.findUnique({
            where: { id: approvalReq.referenceId },
            include: {
                member: { select: { id: true, name: true, nrp: true } },
            },
        });

        if (!originalTx) {
            return NextResponse.json(
                { message: "Transaksi asli tidak ditemukan." },
                { status: 404 }
            );
        }

        if (action === "approved") {
            // ── CONTRA-ENTRY: Buat transaksi pembalik ──────────────────────
            const contraNo = `CE-${Date.now()}-${Math.random()
                .toString(36)
                .substring(2, 5)
                .toUpperCase()}`;

            // Hash keamanan untuk contra-entry
            const hashInput = `${originalTx.member?.nrp || "UMUM"}-${-Number(originalTx.amount)}-${contraNo}-${now.toISOString()}`;
            const securityHash = crypto.createHash("sha256").update(hashInput).digest("hex");

            await prisma.$transaction(async (tx) => {
                // 0. Atomic guard: claim this approval exclusively
                const claim = await tx.approvalRequest.updateMany({
                    where: { id: approvalReq.id, status: "pending" },
                    data: { status: "approved" },
                });
                if (claim.count === 0) {
                    throw new Error("ALREADY_PROCESSED");
                }

                // 1. Buat Contra-Entry (nilai negatif sebagai jejak pembalik)
                await tx.unitTransaction.create({
                    data: {
                        transactionNo: contraNo,
                        memberId: originalTx.memberId,
                        unitType: originalTx.unitType,
                        description: `[VOID] Pembatalan ${originalTx.transactionNo} — ${originalTx.description}`,
                        amount: -Number(originalTx.amount),
                        loanAmount: -Number(originalTx.loanAmount),
                        transactionDate: now,
                        paymentMethod: originalTx.paymentMethod,
                        isPaid: true,
                        paidDate: now,
                        notes: `Contra-Entry untuk void ref: ${originalTx.transactionNo}. Alasan: ${originalTx.voidReason || "-"}`,
                        status: "voided",
                        voidRef: originalTx.transactionNo,
                        voidReason: originalTx.voidReason,
                        voidedById: currentUserId,
                        voidedAt: now,
                        securityHash,
                        createdById: currentUserId,
                    },
                });

                // 2. Update transaksi asli: status = voided
                await tx.unitTransaction.update({
                    where: { id: originalTx.id },
                    data: {
                        status: "voided",
                        voidedById: currentUserId,
                        voidedAt: now,
                    },
                });

                // 3. Update ApprovalRequest metadata
                await tx.approvalRequest.update({
                    where: { id: approvalReq.id },
                    data: {
                        approvedById: currentUserId,
                        approvedAt: now,
                        rejectionReason: notes || null,
                    },
                });

                // 4. Reverse Journal jika ada
                const originalJournal = await tx.journal.findFirst({
                    where: {
                        description: { contains: originalTx.transactionNo },
                        sourceType: "unit_transaction",
                    },
                    include: { lines: true },
                });
                if (originalJournal) {
                    const reverseJournal = await tx.journal.create({
                        data: {
                            journalNo: `RV-${Date.now().toString(36).toUpperCase()}`,
                            branchId: originalJournal.branchId,
                            transactionDate: now,
                            description: `[VOID] Pembalik ${originalJournal.journalNo} - ${originalTx.transactionNo}`,
                            sourceType: "unit_transaction_void",
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

                // 5. Reverse CashBankTransaction (untuk tunai/QRIS) — atomic decrement
                if (originalTx.paymentMethod === "cash" || originalTx.paymentMethod === "qris") {
                    const originalCashTx = await tx.cashBankTransaction.findFirst({
                        where: { description: { contains: originalTx.transactionNo } },
                    });
                    if (originalCashTx) {
                        const voidAmount = Number(originalTx.amount);
                        const updatedAccount = await tx.cashBankAccount.update({
                            where: { id: originalCashTx.accountId },
                            data: { currentBalance: { decrement: voidAmount } },
                        });
                        const balanceBefore = Number(updatedAccount.currentBalance) + voidAmount;

                        const voidCashTx = await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `VOID-${Date.now().toString(36).toUpperCase()}`,
                                accountId: originalCashTx.accountId,
                                branchId: originalCashTx.branchId,
                                type: "out",
                                category: "void_unit_transaction",
                                amount: voidAmount,
                                balanceBefore,
                                balanceAfter: Number(updatedAccount.currentBalance),
                                unitType: originalTx.unitType,
                                description: `[VOID] Pembatalan ${originalTx.transactionNo}`,
                                transactionDate: now,
                                createdById: currentUserId,
                            },
                        });

                        // Adjust running balance chain for subsequent transactions
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
            }, TX_OPTIONS);

            // Kirim notifikasi ke pemohon void (jika kasir)
            try {
                const requester = await prisma.user.findUnique({ where: { id: approvalReq.requestedById }, select: { fcmToken: true } });
                if (requester?.fcmToken) {
                    await sendPushNotification({
                        to: requester.fcmToken,
                        title: "✅ Void Disetujui",
                        body: `Permintaan void transaksi jasa ${originalTx.transactionNo} telah disetujui.`,
                        data: { screen: "RiwayatKasir" }
                    });
                }
            } catch (e) { console.error("Push failed:", e); }

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "DELETE",
                    module: "Unit_Layanan",
                    description: `VOID APPROVE transaksi ${originalTx.transactionNo} (${originalTx.unitType})`,
                    targetId: originalTx.id,
                    targetType: "UnitTransaction",
                    metadata: { contraEntryNo: contraNo, approvedBy: currentUserId },
                    unitType: originalTx.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                message: `Void disetujui. Contra-Entry [${contraNo}] berhasil dibuat. Limit anggota telah dipulihkan.`,
                data: {
                    originalTransactionNo: originalTx.transactionNo,
                    contraEntryNo: contraNo,
                    action: "approved",
                },
            });
        } else {
            // ── REJECTED: Kembalikan status transaksi ke 'completed' ──────
            await prisma.$transaction(async (tx) => {
                // FIX: Atomic guard — prevent double-processing
                const claim = await tx.approvalRequest.updateMany({
                    where: { id: approvalReq.id, status: "pending" },
                    data: { status: "rejected" },
                });
                if (claim.count === 0) {
                    throw new Error("ALREADY_PROCESSED");
                }

                await tx.unitTransaction.update({
                    where: { id: originalTx.id },
                    data: {
                        status: "completed",
                        voidReason: null,
                        voidRequestedById: null,
                        voidRequestedAt: null,
                    },
                });

                await tx.approvalRequest.update({
                    where: { id: approvalReq.id },
                    data: {
                        rejectedById: currentUserId,
                        rejectedAt: now,
                        rejectionReason: notes || "Ditolak oleh Admin Unit.",
                    },
                });
            }, TX_OPTIONS);

            // Kirim notifikasi ke pemohon void
            try {
                const requester = await prisma.user.findUnique({ where: { id: approvalReq.requestedById }, select: { fcmToken: true } });
                if (requester?.fcmToken) {
                    await sendPushNotification({
                        to: requester.fcmToken,
                        title: "❌ Void Ditolak",
                        body: `Permintaan void transaksi jasa ${originalTx.transactionNo} ditolak. Alasan: ${notes || "Ditolak admin"}`,
                        data: { screen: "RiwayatKasir" }
                    });
                }
            } catch (e) { console.error("Push failed:", e); }

            // Audit log
            try {
                await logAuditFromRequest(request, session, {
                    action: "REJECT",
                    module: "Unit_Layanan",
                    description: `VOID REJECT transaksi ${originalTx.transactionNo} (${originalTx.unitType})${notes ? ` — ${notes}` : ""}`,
                    targetId: originalTx.id,
                    targetType: "UnitTransaction",
                    metadata: { rejectedBy: currentUserId, rejectionReason: notes },
                    unitType: originalTx.unitType,
                });
            } catch (e) { /* audit failure must not break response */ }

            return NextResponse.json({
                message: `Permintaan void ditolak. Transaksi [${originalTx.transactionNo}] kembali aktif.`,
                data: {
                    originalTransactionNo: originalTx.transactionNo,
                    action: "rejected",
                },
            });
        }
    } catch (error: any) {
        if (error?.message === "ALREADY_PROCESSED") {
            return NextResponse.json(
                { message: "Request ini sudah diproses sebelumnya oleh admin lain." },
                { status: 409 }
            );
        }

        // Enhanced error logging for debugging
        const errorInfo = {
            message: error?.message,
            code: error?.code,
            meta: error?.meta,
            stack: error?.stack?.substring(0, 500),
        };
        console.error("POST /api/unit-transactions/void-approve error:", JSON.stringify(errorInfo, null, 2));

        // Detect Prisma transaction timeout
        const isPrismaTimeout = error?.code === "P2028" || error?.message?.includes("Transaction API error");
        const userMessage = isPrismaTimeout
            ? "Timeout: Proses void memakan waktu terlalu lama. Silakan coba lagi."
            : `Gagal memproses persetujuan void: ${error?.message || "Unknown error"}`;

        return NextResponse.json(
            { message: userMessage },
            { status: 500 }
        );
    }
}
