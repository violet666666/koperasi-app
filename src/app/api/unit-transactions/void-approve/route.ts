import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";
import { sendPushNotification } from "@/lib/expo-push";

export const dynamic = "force-dynamic";

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
        const allowedRoles = ["operator", "admin", "super_admin", "admin_unit"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json(
                { message: "Anda tidak memiliki izin untuk menyetujui/menolak void." },
                { status: 403 }
            );
        }

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

                    // Kembalikan stok semua item produk fisik
                    for (const item of storeSale.items) {
                        const prod = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                        if (prod && !prod.isService) {
                            const newStockToko = prod.stockToko + item.quantity;
                            const newStock = newStockToko + prod.stockGdg;

                            await tx.storeProduct.update({
                                where: { id: item.productId },
                                data: {
                                    stockToko: newStockToko,
                                    stock: newStock,
                                },
                            });

                            await tx.storeStockMovement.create({
                                data: {
                                    productId: item.productId,
                                    type: "in",
                                    quantity: item.quantity,
                                    reference: `VOID ${storeSale.saleNo}`,
                                    notes: `Pengembalian stok (void disetujui)`,
                                    operatorId: currentUserId,
                                },
                            });
                        }
                    }

                    // Update metadata StoreSale: tandai voided, hapus voidPending
                    metadata.isVoided = true;
                    metadata.voidPending = false;
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
                            await tx.journalLine.createMany({
                                data: originalJournal.lines.map((line: any) => ({
                                    journalId: reverseJournal.id,
                                    accountId: line.accountId,
                                    debit: Number(line.credit),
                                    credit: Number(line.debit),
                                    description: `[VOID] ${line.description}`,
                                })),
                            });
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
                                    unitType: storeSale.unitType || "toko",
                                    description: `[VOID] Pembatalan ${storeSale.saleNo}`,
                                    transactionDate: now,
                                    createdById: currentUserId,
                                },
                            });
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
                });

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
                });

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
                    await tx.journalLine.createMany({
                        data: originalJournal.lines.map((line: any) => ({
                            journalId: reverseJournal.id,
                            accountId: line.accountId,
                            debit: Number(line.credit),
                            credit: Number(line.debit),
                            description: `[VOID] ${line.description}`,
                        })),
                    });
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

                        await tx.cashBankTransaction.create({
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
                    }
                }
            });

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
            });

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
        console.error("POST /api/unit-transactions/void-approve error:", error);
        return NextResponse.json(
            { message: "Gagal memproses persetujuan void" },
            { status: 500 }
        );
    }
}
