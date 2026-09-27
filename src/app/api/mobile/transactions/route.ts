import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { AUTO_GENERATED_PIUTANG_PREFIX } from "@/lib/laporan-helpers";

// GET /api/mobile/transactions — Riwayat transaksi simpanan anggota
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
            include: { member: true },
        });

        if (!user?.memberId) {
            return NextResponse.json({ message: "Data anggota tidak ditemukan" }, { status: 404 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "20");
        const type = searchParams.get("type"); // "savings", "unit", "loan"

        const memberId = user.memberId;

        // Savings transactions
        if (!type || type === "savings") {
            const [transactions, total] = await Promise.all([
                prisma.savingsTransaction.findMany({
                    where: { memberId, status: "completed" },
                    include: {
                        account: { include: { product: { select: { name: true, type: true } } } },
                    },
                    orderBy: { transactionDate: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.savingsTransaction.count({ where: { memberId, status: "completed" } }),
            ]);

            return NextResponse.json({
                data: transactions.map((t) => ({
                    id: t.id,
                    type: t.type,
                    amount: Number(t.amount),
                    balanceBefore: Number(t.balanceBefore),
                    balanceAfter: Number(t.balanceAfter),
                    transactionDate: t.transactionDate,
                    createdAt: t.createdAt.toISOString(), // S1-06: jam akurat (bukan @db.Date)
                    description: t.notes || t.account?.product?.name || "",
                    productName: t.account?.product?.name,
                    status: t.status,
                })),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        // Unit transactions (Kredit Toko/Jasa)
        if (type === "unit") {
            // Filter di SQL (bukan JS) supaya count + pagination konsisten:
            // - auto-generated salary_cut UnitTransaction duplikat StoreSale
            // - StoreSale voided
            const unitWhere = {
                memberId,
                NOT: [{ paymentMethod: "salary_cut", notes: { startsWith: AUTO_GENERATED_PIUTANG_PREFIX } }],
            };
            const storeWhere = {
                memberId,
                NOT: { metadata: { path: ["isVoided"], equals: true } },
            };

            const startIdx = (page - 1) * limit;
            // Window fetch: top-N merged dapat paling banyak N baris dari satu
            // sumber, jadi ambil top (startIdx + limit) dari tiap tabel lalu merge-slice.
            const fetchWindow = startIdx + limit;

            const [unitTxns, unitCount, storeSales, storeCount] = await Promise.all([
                prisma.unitTransaction.findMany({
                    where: unitWhere,
                    orderBy: { createdAt: "desc" },
                    take: fetchWindow,
                }),
                prisma.unitTransaction.count({ where: unitWhere }),
                prisma.storeSale.findMany({
                    where: storeWhere,
                    orderBy: { createdAt: "desc" },
                    take: fetchWindow,
                    select: {
                        id: true, saleNo: true, totalAmount: true,
                        paymentMethod: true, createdAt: true, unitType: true,
                        metadata: true,
                        items: { select: { product: { select: { name: true } }, quantity: true, unitPrice: true, subtotal: true } },
                    },
                }),
                prisma.storeSale.count({ where: storeWhere }),
            ]);

            const paymentLabels: Record<string, string> = { cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji" };

            const mappedStoreSales = storeSales.map((s: any) => ({
                id: `SS-${s.id}`,
                type: s.unitType || "toko",
                amount: Number(s.totalAmount),
                description: s.items?.map((i: any) => `${i.product?.name || "[Produk Dihapus]"} x${i.quantity}`).join(', ') || `Pembelian ${s.unitType || "Toko"}`,
                transactionDate: s.createdAt,
                createdAt: s.createdAt.toISOString(),
                // Potong-gaji lunas bila billing process sudah settle (metadata.isSettled)
                // — sama dengan web /api/member-portal/transactions.
                isPaid: s.paymentMethod !== "salary_cut" || s.metadata?.isSettled === true,
                status: "completed",
                paymentMethod: s.paymentMethod,
                paymentMethodLabel: paymentLabels[s.paymentMethod] || s.paymentMethod,
            }));

            const mappedUnitTxns = unitTxns.map((t) => ({
                id: t.id,
                type: t.unitType,
                amount: Number(t.amount),
                description: t.description,
                transactionDate: t.transactionDate,
                createdAt: t.createdAt.toISOString(),
                isPaid: t.isPaid,
                status: t.status,
                paymentMethod: t.paymentMethod,
                paymentMethodLabel: paymentLabels[t.paymentMethod] || t.paymentMethod,
            }));

            // Merge and sort by date
            const allTxns = [...mappedUnitTxns, ...mappedStoreSales]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

            const total = unitCount + storeCount;
            const paginated = allTxns.slice(startIdx, startIdx + limit);

            return NextResponse.json({
                data: paginated,
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        // Loan payments
        if (type === "loan") {
            const loanWhere = { memberId, status: { not: "voided" } };
            const [payments, total] = await Promise.all([
                prisma.loanPayment.findMany({
                    where: loanWhere,
                    include: { loan: { select: { loanNo: true } } },
                    orderBy: { paymentDate: "desc" },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.loanPayment.count({ where: loanWhere }),
            ]);

            return NextResponse.json({
                data: payments.map((p) => ({
                    id: p.id,
                    type: "payment",
                    amount: Number(p.amount),
                    principalPortion: Number(p.principalPortion),
                    interestPortion: Number(p.interestPortion),
                    transactionDate: p.paymentDate,
                    createdAt: p.createdAt.toISOString(), // S1-06: jam akurat
                    description: `Angsuran ${p.loan?.loanNo || ""}`,
                    status: p.status,
                    isPaid: p.status === "completed",
                })),
                meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
            });
        }

        return NextResponse.json({ data: [], meta: { page, limit, total: 0, totalPages: 0 } });
    } catch (error) {
        console.error("GET /api/mobile/transactions error:", error);
        return NextResponse.json({ message: "Gagal memuat transaksi" }, { status: 500 });
    }
}
