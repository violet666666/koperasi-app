import { NextResponse } from "next/server";
import prisma, { prismaRead } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { storeSaleUnitTypeFilter, unitTypeFilter } from "@/lib/constants/units";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/unit/[slug]/laporan
 * Query params: dateFrom, dateTo, period (today|week|month|year|custom),
 *               page (default 1), perPage (default 50), export (boolean)
 *
 * Returns aggregated transaction report for the given unit slug.
 * - Unit Jasa (cuci_mobil, barbershop, dll): queries UnitTransaction
 * - Unit Toko: queries StoreSale + UnitTransaction (piutang)
 * - Pagination only applies to the transactions list; summary/expenses/incomes are always complete.
 * - export=true returns ALL transactions without pagination (for Excel/Print).
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

        // Access control: kasir/admin can only access their own unit (alias-aware)
        if (!isOperator && userUnitType && !isSameUnit(userUnitType, unitType)) {
            return NextResponse.json({ message: "Akses ditolak. Anda tidak terdaftar di unit ini." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "month";
        const dateFromParam = searchParams.get("dateFrom");
        const dateToParam = searchParams.get("dateTo");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get("perPage") || "50", 10)) || 50);
        const isExport = searchParams.get("export") === "true";
        const sortBy = searchParams.get("sortBy") || "transactionDate";
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

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

        // Units that use store_sales (via /api/toko/sales) instead of just unit_transactions
        const usesStoreSales = !["cuci_mobil", "simpan_pinjam", "investasi_modal_jp"].includes(unitType);
        const isCuciMobil = unitType === "cuci_mobil";
        const SHU_PER_CUCI_ANGGOTA = 2000; // Rp 2.000 per transaksi anggota

        // --- Fixing @db.Date vs Timestamptz boundaries ---
        // 'dateFrom' and 'dateTo' are exact UTC offsets for Timestamptz.
        // For columns mapped to @db.Date (like UnitTransaction.transactionDate), 
        // passing offset UTCs causes Postgres to coercively cast them, expanding the bounds erroneously.
        // We MUST convert the UTC boundaries into exactly 00:00:00 and 23:59:59 for the Date bounds.
        const fromWib = new Date(dateFrom.getTime() + WIB_OFFSET);
        const toWib = new Date(dateTo.getTime() + WIB_OFFSET);

        const dateFromDbDate = new Date(Date.UTC(fromWib.getUTCFullYear(), fromWib.getUTCMonth(), fromWib.getUTCDate()));
        const dateToDbDate = new Date(Date.UTC(toWib.getUTCFullYear(), toWib.getUTCMonth(), toWib.getUTCDate(), 23, 59, 59, 999));

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

        // ── Fetch Unit Transactions ────────────────────────────────────────
        // Untuk unit Toko/Resto: tetap ambil UnitTransaction, tapi EXCLUDE
        // record piutang otomatis (TK-UTG-xxx) karena angka tersebut sudah
        // tercatat di StoreSale — menghindari duplikasi pendapatan.
        let unitTransactions: any[] = [];
        const unitTxWhere: any = {
            unitType: unitTypeFilter(unitType),
            transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
            status: { notIn: ["voided"] },
        };

        // Untuk toko/resto, exclude auto-generated piutang records (web TK-UTG- & mobile MB-UTG-)
        if (usesStoreSales) {
            unitTxWhere.NOT = [
                { transactionNo: { startsWith: "TK-UTG-" } },
                { transactionNo: { startsWith: "MB-UTG-" } },
            ];
        }

        // Try prismaRead (Neon HTTP) first, fall back to prisma (TCP) for resilience
        try {
            unitTransactions = await prismaRead.unitTransaction.findMany({
                where: unitTxWhere,
                include: {
                    member: { select: { id: true, name: true, nrp: true, memberNo: true } },
                },
                orderBy: { [sortBy]: sortOrder },
            });
        } catch (readError) {
            console.warn("[Laporan API] prismaRead failed for unitTx, falling back to TCP:", readError instanceof Error ? readError.message : readError);
            unitTransactions = await prisma.unitTransaction.findMany({
                where: unitTxWhere,
                include: {
                    member: { select: { id: true, name: true, nrp: true, memberNo: true } },
                },
                orderBy: { [sortBy]: sortOrder },
            });
        }

        // ── Fetch StoreSale (all units using store_sales) ──────────────────────
        let storeSales: any[] = [];
        if (usesStoreSales) {
            const storeSaleQuery = {
                where: {
                    unitType: storeSaleUnitTypeFilter(unitType),
                    createdAt: { gte: dateFrom, lte: dateTo },
                },
                include: {
                    member: { select: { id: true, name: true, nrp: true } },
                    items: { include: { product: { select: { name: true } } } },
                },
                orderBy: { [sortBy === "transactionDate" ? "createdAt" : sortBy]: sortOrder },
            };
            let rawStoreSales: any[];
            try {
                rawStoreSales = await prismaRead.storeSale.findMany(storeSaleQuery);
            } catch (readError) {
                console.warn("[Laporan API] prismaRead failed for storeSales, falling back to TCP:", readError instanceof Error ? readError.message : readError);
                rawStoreSales = await prisma.storeSale.findMany(storeSaleQuery);
            }
            storeSales = rawStoreSales.filter(sale => {
                try {
                    const meta = typeof sale.metadata === 'string' ? JSON.parse(sale.metadata) : sale.metadata || {};
                    return !meta.isVoided;
                } catch { return true; }
            });
        }

        // ── Fetch Operational Expenses (CashBankTransaction) ─────────────────
        // Use alias-aware unitType filter instead of fragile description contains
        const opsUnitTypeFilter = storeSaleUnitTypeFilter(unitType);
        const operationalExpenses = await prisma.cashBankTransaction.findMany({
            where: {
                type: "out",
                category: "operational",
                unitType: opsUnitTypeFilter,
                transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
            },
            orderBy: { transactionDate: "desc" },
        });

        // ── Fetch Operational Income (CashBankTransaction type="in") ──────────
        const operationalIncomes = await prisma.cashBankTransaction.findMany({
            where: {
                type: "in",
                category: "operational",
                unitType: opsUnitTypeFilter,
                transactionDate: { gte: dateFromDbDate, lte: dateToDbDate },
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
                // Dine-in vs takeaway breakdown (from metadata)
                const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
                const orderType = (meta as Record<string, unknown>).orderType as string || "dine_in";
                if (orderType === "takeaway") { acc.takeaway += amount; acc.takeawayCount += 1; }
                else if (orderType === "counter") { acc.counter += amount; acc.counterCount += 1; }
                else { acc.dineIn += amount; acc.dineInCount += 1; }
                // Takeaway surcharge breakdown
                const surcharge = (meta as Record<string, unknown>).takeawaySurcharge as number | null;
                if (surcharge) acc.takeawaySurchargeTotal += surcharge;
                return acc;
            }, { total: 0, count: 0, tunai: 0, qris: 0, potongGaji: 0, dineIn: 0, takeaway: 0, counter: 0, dineInCount: 0, takeawayCount: 0, counterCount: 0, takeawaySurchargeTotal: 0 });
        };

        const unitTxAgg = aggregateUnitTx(unitTransactions);
        const storeSaleAgg = aggregateStoreSales(storeSales);
        const totalExpenses = operationalExpenses.reduce((s, e) => s + Number(e.amount), 0);
        const totalOpIncome = operationalIncomes.reduce((s, e) => s + Number(e.amount), 0);

        // ── Hitung Potongan SHU Langsung (khusus Cuci Mobil) ──────────────────
        // Setiap transaksi cuci mobil yang dilakukan oleh ANGGOTA (memberId != null)
        // dan statusnya BUKAN voided, akan dipotong Rp 2.000 dari laba unit.
        let potonganSHUMember = 0;
        let jumlahCuciAnggota = 0;
        if (isCuciMobil) {
            const txAnggotaValid = unitTransactions.filter(
                (tx: any) => tx.memberId != null && tx.status !== "voided"
            );
            jumlahCuciAnggota = txAnggotaValid.length;
            potonganSHUMember = jumlahCuciAnggota * SHU_PER_CUCI_ANGGOTA;
        }

        // ── Build unified transaction list ─────────────────────────────────────
        // Unit Transactions
        const unitTxRows = unitTransactions.map((tx) => {
            // Extract vehicle plate from notes if present
            const vehiclePlateMatch = tx.notes?.match(/\[PLAT:(.*?)\]/);
            const vehiclePlate = vehiclePlateMatch ? vehiclePlateMatch[1].trim() : null;
            return {
                id: tx.transactionNo,
                date: (tx as any).createdAt || tx.transactionDate,
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
            description: sale.items.map((i: any) => i.product?.name || "[Produk Dihapus]").join(", ") || sale.customerName || "Penjualan Toko",
            memberName: sale.member?.name || sale.customerName || null,
            memberNrp: sale.member?.nrp || null,
            paymentMethod: sale.paymentMethod,
            amount: Number(sale.totalAmount),
            status: "completed",
            type: "store_sale",
            vehiclePlate: null,
        }));

        // Merge & sort — respect sortBy/sortOrder from query params
        const getSortValue = (item: typeof unitTxRows[number], field: string): string | number => {
            switch (field) {
                case "transactionDate": return new Date(item.date).getTime();
                case "transactionNo": return item.no;
                case "amount": return item.amount;
                default: return new Date(item.date).getTime();
            }
        };
        const allTransactions = [...(usesStoreSales ? storeSaleRows : []), ...unitTxRows]
            .sort((a, b) => {
                const va = getSortValue(a, sortBy);
                const vb = getSortValue(b, sortBy);
                const cmp = typeof va === "number" && typeof vb === "number"
                    ? va - vb
                    : String(va).localeCompare(String(vb));
                return sortOrder === "asc" ? cmp : -cmp;
            });

        // Pagination: slice transactions unless export mode
        const totalTransactions = allTransactions.length;
        const totalPages = Math.ceil(totalTransactions / perPage);
        const paginatedTransactions = isExport
            ? allTransactions
            : allTransactions.slice((page - 1) * perPage, page * perPage);

        const totalPendapatan = (usesStoreSales ? storeSaleAgg.total : 0) + unitTxAgg.total + totalOpIncome;

        // ── HPP & Write-off calculation ──
        let totalHPP = 0;
        let totalWriteOff = 0;
        if (usesStoreSales) {
            // Total HPP = SUM(quantity × costPrice) from StoreSaleItems
            totalHPP = storeSales.reduce((acc, sale) => {
                return acc + (sale.items || []).reduce((itemAcc: number, item: any) => {
                    return itemAcc + (Number(item.costPrice) || 0) * item.quantity;
                }, 0);
            }, 0);

            // Total Write-off = SUM(quantity × costAtTime) from non-sale stock movements
            const writeoffMovements = await prisma.storeStockMovement.findMany({
                where: {
                    reason: { in: ["damaged", "expired", "internal_use", "other"] },
                    costAtTime: { not: null },
                    createdAt: { gte: dateFrom, lte: dateTo },
                    status: "active",
                },
                include: { product: { select: { unitType: true } } },
            });
            totalWriteOff = writeoffMovements
                .filter((m) => isSameUnit(m.product?.unitType, unitType))
                .reduce((acc, m) => acc + (Number(m.costAtTime) || 0) * m.quantity, 0);
        }

        return NextResponse.json({
            data: {
                unitType,
                unitSlug: slug,
                periodLabel,
                dateFrom: dateFrom.toISOString(),
                dateTo: dateTo.toISOString(),
                summary: {
                    totalPendapatan,
                    totalTransaksi: (usesStoreSales ? storeSaleAgg.count : 0) + unitTxAgg.count,
                    tunai: (usesStoreSales ? storeSaleAgg.tunai : 0) + unitTxAgg.tunai,
                    qris: (usesStoreSales ? storeSaleAgg.qris : 0) + unitTxAgg.qris,
                    potongGaji: (usesStoreSales ? storeSaleAgg.potongGaji : 0) + unitTxAgg.potongGaji,
                    // Dine-in vs takeaway breakdown
                    dineIn: usesStoreSales ? storeSaleAgg.dineIn : 0,
                    takeaway: usesStoreSales ? storeSaleAgg.takeaway : 0,
                    counter: usesStoreSales ? storeSaleAgg.counter : 0,
                    dineInCount: usesStoreSales ? storeSaleAgg.dineInCount : 0,
                    takeawayCount: usesStoreSales ? storeSaleAgg.takeawayCount : 0,
                    counterCount: usesStoreSales ? storeSaleAgg.counterCount : 0,
                    takeawaySurchargeTotal: usesStoreSales ? storeSaleAgg.takeawaySurchargeTotal : 0,
                    totalPengeluaran: totalExpenses,
                    totalPemasukan: totalOpIncome, // Pemasukan manual di luar POS
                    // Potongan SHU Langsung (khusus cuci_mobil)
                    potonganSHUMember: isCuciMobil ? potonganSHUMember : 0,
                    jumlahCuciAnggota: isCuciMobil ? jumlahCuciAnggota : 0,
                    shuPerCuci: isCuciMobil ? SHU_PER_CUCI_ANGGOTA : 0,
                    // Laba sudah dikurangi potongan SHU
                    laba: totalPendapatan - totalExpenses - (isCuciMobil ? potonganSHUMember : 0),
                    // HPP & Profit
                    totalHPP,
                    totalWriteOff,
                    netProfit: totalPendapatan - totalHPP - totalWriteOff - totalExpenses - (isCuciMobil ? potonganSHUMember : 0),
                },
                transactions: paginatedTransactions,
                pagination: {
                    page: isExport ? 1 : page,
                    perPage: isExport ? totalTransactions : perPage,
                    total: totalTransactions,
                    totalPages: isExport ? 1 : totalPages,
                },
                operationalExpenses: operationalExpenses.map((e) => {
                    const rawDesc = e.description || "";
                    const parts = rawDesc.split("||RECEIPT:");
                    // Strip any alias variant prefix: [RESTO], [RESTO_CAFE], [COFFE_LATAR], etc.
                    const description = parts[0].replace(/^\[[A-Z_]+\]\s*Pengeluaran Operasional:\s*/, "");
                    const receiptImagePath = parts[1] || null;

                    return {
                        id: e.id,
                        date: e.transactionDate,
                        transactionNo: e.transactionNo,
                        description: description,
                        amount: Number(e.amount),
                        receiptImagePath: receiptImagePath,
                        paymentMethod: e.paymentMethod || null,
                    };
                }),
                operationalIncomes: operationalIncomes.map((e) => {
                    const rawDesc = e.description || "";
                    const parts = rawDesc.split("||RECEIPT:");
                    // Strip any alias variant prefix: [RESTO], [RESTO_CAFE], [COFFE_LATAR], etc.
                    const description = parts[0].replace(/^\[[A-Z_]+\]\s*Pemasukan Operasional:\s*/, "");
                    const receiptImagePath = parts[1] || null;

                    return {
                        id: e.id,
                        date: e.transactionDate,
                        transactionNo: e.transactionNo,
                        description: description,
                        amount: Number(e.amount),
                        receiptImagePath: receiptImagePath,
                        paymentMethod: e.paymentMethod || null,
                    };
                }),
            }
        });

    } catch (error) {
        console.error("GET /api/unit/[slug]/laporan error:", error);
        return NextResponse.json({ message: "Gagal mengambil data laporan" }, { status: 500 });
    }
}
