import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { paginationSchema } from "@/lib/validations";

// GET /api/member-portal/transactions - Get member's all transactions
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = session.user.memberId;
        const { searchParams } = new URL(request.url);

        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 20,
            search: searchParams.get("search") || undefined,
        });

        const type = searchParams.get("type"); // unit, savings, loan
        const unitType = searchParams.get("unitType");
        const isPaid = searchParams.get("isPaid");

        // Build response based on transaction type filter
        const result: {
            unitTransactions?: unknown[];
            savingsTransactions?: unknown[];
            loanPayments?: unknown[];
            meta: { page: number; perPage: number; total: number };
        } = {
            meta: { page: query.page, perPage: query.perPage, total: 0 },
        };

        if (!type || type === "unit") {
            const unitWhere: Record<string, unknown> = {
                memberId,
                status: { notIn: ["voided"] },
            };
            if (unitType && unitType !== "all") unitWhere.unitType = unitType;
            if (isPaid !== null && isPaid !== undefined && isPaid !== "all") {
                unitWhere.isPaid = isPaid === "true";
            }

            // Fetch StoreSale for store-based units (toko, cafe_lsp, playstation, resto, coffe_latar)
            const storeBasedUnits = ["toko", "cafe_lsp", "playstation", "resto", "coffe_latar"];
            const includeStoreSales = !unitType || unitType === "all" || storeBasedUnits.includes(unitType);

            const fetchLimit = type === "unit" ? Math.max(query.perPage * 3, query.perPage + (query.page * query.perPage)) : 10;

            const [unitTxns, unitCount, storeSales] = await Promise.all([
                prisma.unitTransaction.findMany({
                    where: unitWhere,
                    orderBy: { transactionDate: "desc" },
                    take: fetchLimit,
                }),
                prisma.unitTransaction.count({ where: unitWhere }),
                includeStoreSales ? prisma.storeSale.findMany({
                    where: {
                        memberId,
                        NOT: { metadata: { path: ["isVoided"], equals: true } },
                    },
                    orderBy: { createdAt: "desc" },
                    take: fetchLimit,
                    select: {
                        id: true, saleNo: true, totalAmount: true,
                        paymentMethod: true, customerName: true, createdAt: true,
                        metadata: true, unitType: true,
                        items: { select: { product: { select: { name: true } }, quantity: true, unitPrice: true, subtotal: true } },
                        cashierIdentity: { select: { displayName: true } },
                    },
                }) : Promise.resolve([]),
            ]);

            // Count non-voided StoreSales at DB level
            const storeCount = includeStoreSales
                ? await prisma.storeSale.count({
                    where: {
                        memberId,
                        NOT: { metadata: { path: ["isVoided"], equals: true } },
                    },
                })
                : 0;

            const mappedUnitTxns = unitTxns
                .filter((t) => {
                    // Exclude auto-generated salary_cut piutang — StoreSale already represents them
                    if (t.paymentMethod === "salary_cut" && t.notes?.startsWith("Auto-generated dari penjualan kasir")) {
                        return false;
                    }
                    return true;
                })
                .map((t) => ({
                    id: t.id,
                    transactionNo: t.transactionNo,
                    unitType: t.unitType,
                    description: t.description,
                    amount: Number(t.amount),
                    paymentMethod: t.paymentMethod,
                    paymentMethodLabel: t.paymentMethod === "salary_cut" ? "Potong Gaji" : t.paymentMethod === "qris" ? "QRIS" : t.paymentMethod === "cash" ? "Tunai" : t.paymentMethod,
                    transactionDate: t.transactionDate,
                    isPaid: t.isPaid,
                    category: "unit",
                    status: t.status,
                }));

            const mappedStoreSales = storeSales.map((s: any) => {
                    const itemDesc = s.items?.map((i: any) => `${i.product?.name || "[Produk Dihapus]"} x${i.quantity}`).join(', ');
                    const paymentLabels: Record<string, string> = { cash: "Tunai", qris: "QRIS", salary_cut: "Potong Gaji" };
                    return {
                        id: `SS-${s.id}`,
                        saleId: s.id,
                        transactionNo: s.saleNo,
                        unitType: s.unitType || "toko",
                        description: itemDesc || `Pembelian ${s.unitType || "Toko"} PRIMKOPPOL`,
                        amount: Number(s.totalAmount),
                        paymentMethod: s.paymentMethod,
                        paymentMethodLabel: paymentLabels[s.paymentMethod] || s.paymentMethod,
                        transactionDate: s.createdAt,
                        isPaid: s.paymentMethod !== "salary_cut",
                        category: "unit",
                        status: "completed",
                        cashierDisplayName: s.cashierIdentity?.displayName || null,
                        items: s.items?.map((i: any) => ({
                            name: i.product?.name || "[Produk Dihapus]",
                            quantity: i.quantity,
                            unitPrice: Number(i.unitPrice),
                            subtotal: Number(i.subtotal),
                        })) || [],
                    };
                });

            // Merge & sort by date
            const allUnitTxns = [...mappedUnitTxns, ...mappedStoreSales]
                .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

            // Apply pagination after merge
            const startIdx = type === "unit" ? (query.page - 1) * query.perPage : 0;
            const endIdx = type === "unit" ? startIdx + query.perPage : 5;
            result.unitTransactions = allUnitTxns.slice(startIdx, endIdx);
            // Adjust count: subtract auto-generated UnitTransactions excluded by in-memory filter
            const excludedCount = unitTxns.length - mappedUnitTxns.length;
            if (type === "unit") result.meta.total = Math.max(0, unitCount - excludedCount) + storeCount;
        }

        if (!type || type === "savings") {
            const [savingsTxns, savingsCount] = await Promise.all([
                prisma.savingsTransaction.findMany({
                    where: { memberId, status: "completed" },
                    include: {
                        account: {
                            include: {
                                product: {
                                    select: { code: true, name: true, type: true },
                                },
                            },
                        },
                    },
                    orderBy: { transactionDate: "desc" },
                    skip: type === "savings" ? (query.page - 1) * query.perPage : 0,
                    take: type === "savings" ? query.perPage : 5,
                }),
                prisma.savingsTransaction.count({ where: { memberId, status: "completed" } }),
            ]);

            result.savingsTransactions = savingsTxns.map((t) => ({
                id: t.id,
                transactionNo: t.transactionNo,
                type: t.type,
                amount: Number(t.amount),
                balanceBefore: Number(t.balanceBefore),
                balanceAfter: Number(t.balanceAfter),
                transactionDate: t.transactionDate,
                notes: t.notes,
                product: t.account?.product,
                category: "savings",
            }));
            if (type === "savings") result.meta.total = savingsCount;
        }

        if (!type || type === "loan") {
            const [loanPayments, loanCount] = await Promise.all([
                prisma.loanPayment.findMany({
                    where: { memberId },
                    include: {
                        loan: {
                            select: { loanNo: true, productSnapshot: true },
                        },
                    },
                    orderBy: { paymentDate: "desc" },
                    skip: type === "loan" ? (query.page - 1) * query.perPage : 0,
                    take: type === "loan" ? query.perPage : 5,
                }),
                prisma.loanPayment.count({ where: { memberId } }),
            ]);

            result.loanPayments = loanPayments.map((p) => ({
                id: p.id,
                paymentNo: p.paymentNo,
                amount: Number(p.amount),
                principalPortion: Number(p.principalPortion),
                interestPortion: Number(p.interestPortion),
                paymentDate: p.paymentDate,
                loan: p.loan,
                category: "loan",
            }));
            if (type === "loan") result.meta.total = loanCount;
        }

        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/member-portal/transactions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch transactions" },
            { status: 500 }
        );
    }
}
