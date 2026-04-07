import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import crypto from "crypto";

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
// Format: VOID-(originalTransactionNo)
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
        const isOperator = session.user.role === "operator" || session.user.permissions?.includes("manage_all");
        const now = new Date();
        
        let branchIdToUse = session.user.branchId || 1;
        if (!session.user.branchId) {
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            if (headOffice) branchIdToUse = headOffice.id;
        }

        // 1. PENANGANAN TRANSAKSI TOKO (StoreSale)
        // Prefix TK-, POS-, TS- bisa berasal dari StoreSale (Toko POS Tunai) ATAU UnitTransaction (Potong Gaji Toko)
        // Kita coba cari di StoreSale dulu; jika tidak ada, fall-through ke UnitTransaction di bawah
        if (String(transactionNo).startsWith("POS-") || String(transactionNo).startsWith("TK-") || String(transactionNo).startsWith("TS-") ) {
            const storeSale = await prisma.storeSale.findUnique({
                where: { saleNo: String(transactionNo) },
                include: { member: true, createdBy: true, items: true },
            });

            if (storeSale) {
            
            const metadata: any = storeSale.metadata ? (typeof storeSale.metadata === 'object' ? storeSale.metadata : JSON.parse(storeSale.metadata as string)) : {};
            if (metadata.isVoided) return NextResponse.json({ message: "Transaksi Toko ini sudah dibatalkan." }, { status: 409 });
            if (metadata.voidPending) return NextResponse.json({ message: "Permintaan void untuk transaksi ini sudah menunggu persetujuan Admin." }, { status: 409 });

            // JALUR A: Operator/Superadmin → Void langsung (bypass approval)
            if (isOperator) {
                // Kembalikan Stok
                for (const item of storeSale.items) {
                    const prod = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
                    if (prod && !prod.isService) {
                        await prisma.storeProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
                    }
                }

                // Tandai sebagai voided
                metadata.isVoided = true;
                metadata.voidReason = reason;
                metadata.voidedById = currentUserId;
                metadata.voidedAt = now.toISOString();

                await prisma.storeSale.update({
                    where: { id: storeSale.id },
                    data: { metadata: metadata },
                });

                return NextResponse.json({
                    message: "Transaksi Toko dibatalkan oleh Operator. Stok telah dikembalikan.",
                    data: { transactionNo: storeSale.saleNo, status: "voided" },
                });
            }

            // JALUR B: Kasir/Admin Unit → Buat ApprovalRequest pending
            // Tandai transaksi bahwa ada permintaan void yang menunggu
            metadata.voidPending = true;
            metadata.voidPendingReason = reason;
            metadata.voidRequestedById = currentUserId;
            metadata.voidRequestedAt = now.toISOString();

            await prisma.storeSale.update({
                where: { id: storeSale.id },
                data: { metadata: metadata },
            });

            // Buat entri approval request — requestNo = VOID-{saleNo} agar mudah dilacak
            const requestNo = generateVoidRequestNo(storeSale.saleNo);
            await prisma.approvalRequest.create({
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
                    },
                },
            });

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

        if (!transaction) return NextResponse.json({ message: `Transaksi ${transactionNo} tidak ditemukan.` }, { status: 404 });
        if (transaction.status !== "completed") return NextResponse.json({ message: `Status transaksi saat ini sudah berstatus: ${transaction.status}` }, { status: 409 });
        if (session.user.role === "kasir" && transaction.createdById !== currentUserId) {
            return NextResponse.json({ message: "Kasir hanya dapat mengajukan void untuk transaksi miliknya sendiri." }, { status: 403 });
        }

        // AUTO-APPROVE VOID JIKA OPERATOR atau ADMIN PUSAT
        if (isOperator) {
            const contraNo = `CE-${Date.now()}-${Math.random().toString(36).substring(2, 5).toUpperCase()}`;
             // Hash keamanan untuk contra-entry
            const hashInput = `${transaction.member?.nrp || "UMUM"}-${-Number(transaction.amount)}-${contraNo}-${now.toISOString()}`;
            const securityHash = crypto.createHash("sha256").update(hashInput).digest("hex");

            await prisma.$transaction([
                // 1. Buat Contra-Entry (nilai negatif)
                prisma.unitTransaction.create({
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
                }),
                // 2. Update status transaksi asli = voided
                prisma.unitTransaction.update({
                    where: { id: transaction.id },
                    data: { status: "voided", voidReason: reason, voidedById: currentUserId, voidedAt: now },
                })
            ]);

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

        return NextResponse.json({
            message: "Permintaan void berhasil diajukan. Menunggu persetujuan Admin Unit.",
            data: { transactionNo: updatedTx.transactionNo, status: updatedTx.status, approvalRequestNo: approvalReq.requestNo },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit-transactions/void-request error:", error);
        return NextResponse.json({ message: "Gagal mengajukan void transaksi" }, { status: 500 });
    }
}
