import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * GET /api/unit/[slug]/laporan
 * Query params: dateFrom, dateTo, period (today|week|month|year|custom)
 *
 * Returns aggregated transaction report for the given unit slug.
 * - Unit Jasa (cuci_mobil, barbershop, dll): queries UnitTransaction
 * - Unit Toko: queries StoreSale + UnitTransaction (piutang)
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const slug = params.slug;
        const unitType = slug.replace(/-/g, "_");

        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");

        // Access control: kasir/admin can only access their own unit
        if (!isOperator && userUnitType && userUnitType !== unitType) {
            return NextResponse.json({ message: "Akses ditolak. Anda tidak terdaftar di unit ini." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "month";
        const dateFromParam = searchParams.get("dateFrom");
        const dateToParam = searchParams.get("dateTo");

        // Compute date range with WIB (+7) timezone
        const now = new Date();
        const WIB_OFFSET = 7 * 60 * 60 * 1000;
        const nowWIB = new Date(now.getTime() + WIB_OFFSET);
        // Use UTC methods to get WIB-correct date components
        const wibYear = nowWIB.getUTCFullYear();
        const wibMonth = nowWIB.getUTCMonth();
        const wibDay = nowWIB.getUTCDate();

        let dateFrom: Date;
        let dateTo: Date = new Date(Date.UTC(wibYear, wibMonth, wibDay, 23 - 7, 59, 59, 999)); // 23:59:59 WIB = 16:59:59 UTC

        switch (period) {
            case "today":
                // 00:00 WIB = 17:00 UTC hari sebelumnya
                dateFrom = new Date(Date.UTC(wibYear, wibMonth, wibDay) - WIB_OFFSET);
                dateTo = new Date(dateFrom.getTime() + 86400000 - 1);
                break;
            case "week": {
                // Senin WIB minggu ini
                const dayOfWeek = nowWIB.getUTCDay();
                const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                const mondayWIB = new Date(Date.UTC(wibYear, wibMonth, wibDay + diff));
                dateFrom = new Date(mondayWIB.getTime() - WIB_OFFSET); // 00:00 WIB Senin
                break;
            }
            case "year":
                dateFrom = new Date(Date.UTC(wibYear, 0, 1) - WIB_OFFSET); // 1 Jan 00:00 WIB
                dateTo = new Date(Date.UTC(wibYear, 11, 31, 23 - 7, 59, 59, 999)); // 31 Des 23:59 WIB
                break;
            case "custom":
                if (!dateFromParam || !dateToParam) {
                    return NextResponse.json({ message: "dateFrom dan dateTo wajib diisi untuk period=custom" }, { status: 400 });
                }
                // Custom dates masuk sebagai YYYY-MM-DD — interpretasikan sebagai WIB
                dateFrom = new Date(dateFromParam + "T00:00:00+07:00");
                dateTo = new Date(dateToParam + "T23:59:59+07:00");
                break;
            default: // "month"
                dateFrom = new Date(Date.UTC(wibYear, wibMonth, 1) - WIB_OFFSET); // 1 bulan ini 00:00 WIB
                break;
        }

        const isToko = ["toko", "coffe_latar", "resto"].includes(unitType);

        // Helper: format period label
        const periodLabel = period === "today"
            ? `${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}`
            : period === "week"
            ? `Minggu Ini (${dateFrom.toLocaleDateString("id-ID", { day: "numeric", month: "short" })} – ${dateTo.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})`
            : period === "year"
            ? `Tahun ${now.getFullYear()}`
            : period === "custom"
            ? `${new Date(dateFromParam!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })} – ${new Date(dateToParam!).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}`
            : `${now.toLocaleDateString("id-ID", { month: "long", year: "numeric" })}`;

        // ── Fetch Unit Transactions (semua unit termasuk Toko/piutang) ────────
        const unitTransactions = await prisma.unitTransaction.findMany({
            where: {
                unitType,
                transactionDate: { gte: dateFrom, lte: dateTo },
                status: { notIn: ["voided"] },
            },
            include: {
                member: { select: { id: true, name: true, nrp: true, memberNo: true } },
            },
            orderBy: { transactionDate: "desc" },
        });

        // ── Fetch StoreSale (Toko only) ───────────────────────────────────────
        let storeSales: any[] = [];
        if (isToko) {
            const rawStoreSales = await prisma.storeSale.findMany({
                where: {
                    unitType,
                    createdAt: { gte: dateFrom, lte: dateTo },
                },
                include: {
                    member: { select: { id: true, name: true, nrp: true } },
                    items: { include: { product: { select: { name: true } } } },
                },
                orderBy: { createdAt: "desc" },
            });
            storeSales = rawStoreSales.filter(sale => {
                const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
                return !meta.isVoided;
            });
        }

        // ── Fetch Operational Expenses (CashBankTransaction) ─────────────────
        const operationalExpenses = await prisma.cashBankTransaction.findMany({
            where: {
                type: "out",
                category: "operational",
                description: { contains: `[${unitType.toUpperCase()}]` },
                transactionDate: { gte: dateFrom, lte: dateTo },
            },
            orderBy: { transactionDate: "desc" },
        });

        // ── Aggregate Transactions ─────────────────────────────────────────────
        const aggregateUnitTx = (txs: typeof unitTransactions) => {
            return txs.reduce((acc, tx) => {
                const amount = Number(tx.amount);
                acc.total += amount;
                acc.count += 1;
                if (tx.paymentMethod === "cash") acc.tunai += amount;
                else if (tx.paymentMethod === "qris") acc.qris += amount;
                else if (tx.paymentMethod === "salary_cut") acc.potongGaji += amount;
                return acc;
            }, { total: 0, count: 0, tunai: 0, qris: 0, potongGaji: 0 });
        };

        const aggregateStoreSales = (sales: typeof storeSales) => {
            return sales.reduce((acc, sale) => {
                const amount = Number(sale.totalAmount);
                acc.total += amount;
                acc.count += 1;
                if (sale.paymentMethod === "cash") acc.tunai += amount;
                else if (sale.paymentMethod === "qris") acc.qris += amount;
                else if (sale.paymentMethod === "salary_cut") acc.potongGaji += amount;
                return acc;
            }, { total: 0, count: 0, tunai: 0, qris: 0, potongGaji: 0 });
        };

        const unitTxAgg = aggregateUnitTx(unitTransactions);
        const storeSaleAgg = aggregateStoreSales(storeSales);
        const totalExpenses = operationalExpenses.reduce((s, e) => s + Number(e.amount), 0);

        // ── Build unified transaction list ─────────────────────────────────────
        // Unit Transactions
        const unitTxRows = unitTransactions.map((tx) => {
            // Extract vehicle plate from notes if present
            const vehiclePlateMatch = tx.notes?.match(/\[PLAT:(.*?)\]/);
            const vehiclePlate = vehiclePlateMatch ? vehiclePlateMatch[1].trim() : null;
            return {
                id: tx.transactionNo,
                date: tx.transactionDate,
                no: tx.transactionNo,
                description: tx.description,
                memberName: tx.member?.name || null,
                memberNrp: tx.member?.nrp || null,
                paymentMethod: tx.paymentMethod,
                amount: Number(tx.amount),
                status: tx.status,
                type: "unit_transaction",
                vehiclePlate,
            };
        });

        // Store Sales (Toko)
        const storeSaleRows = storeSales.map((sale) => ({
            id: sale.saleNo,
            date: sale.createdAt,
            no: sale.saleNo,
            description: sale.items.map((i: any) => i.product.name).join(", ") || sale.customerName || "Penjualan Toko",
            memberName: sale.member?.name || sale.customerName || null,
            memberNrp: sale.member?.nrp || null,
            paymentMethod: sale.paymentMethod,
            amount: Number(sale.totalAmount),
            status: "completed",
            type: "store_sale",
            vehiclePlate: null,
        }));

        // Merge & sort
        const allTransactions = [...(isToko ? storeSaleRows : []), ...unitTxRows]
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        return NextResponse.json({
            data: {
                unitType,
                unitSlug: slug,
                periodLabel,
                dateFrom: dateFrom.toISOString(),
                dateTo: dateTo.toISOString(),
                summary: {
                    totalPendapatan: (isToko ? storeSaleAgg.total : 0) + unitTxAgg.total,
                    totalTransaksi: (isToko ? storeSaleAgg.count : 0) + unitTxAgg.count,
                    tunai: (isToko ? storeSaleAgg.tunai : 0) + unitTxAgg.tunai,
                    qris: (isToko ? storeSaleAgg.qris : 0) + unitTxAgg.qris,
                    potongGaji: (isToko ? storeSaleAgg.potongGaji : 0) + unitTxAgg.potongGaji,
                    totalPengeluaran: totalExpenses,
                    laba: ((isToko ? storeSaleAgg.total : 0) + unitTxAgg.total) - totalExpenses,
                },
                transactions: allTransactions,
                operationalExpenses: operationalExpenses.map((e) => ({
                    id: e.id,
                    date: e.transactionDate,
                    transactionNo: e.transactionNo,
                    description: e.description,
                    amount: Number(e.amount),
                })),
            }
        });

    } catch (error) {
        console.error("GET /api/unit/[slug]/laporan error:", error);
        return NextResponse.json({ message: "Gagal mengambil data laporan" }, { status: 500 });
    }
}
