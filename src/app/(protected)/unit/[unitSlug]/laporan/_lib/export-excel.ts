// Dibangun dari page laporan (2026-10-11) — logika VERBATIM, parameter eksplisit agar ter-unit-test.
// Hat-hat: format/merge sel = kontrak visual export Excel laporan unit.
import type * as XLSXModule from "xlsx";
import { METHOD_LABEL } from "../_constants";
import type { LaporanData } from "../_types";

export interface LaporanExcelArgs {
    XLSX: typeof XLSXModule;
    allData: LaporanData;
    unitLabel: string;
    isCuciMobil: boolean;
    usesStoreSales: boolean;
    methodFilters: Set<string>;
}

export interface LaporanExcelResult {
    wb: XLSXModule.WorkBook;
    filename: string;
    txCount: number;
    expCount: number;
    incCount: number;
}

export function buildLaporanExcel({
    XLSX, allData, unitLabel, isCuciMobil, usesStoreSales, methodFilters,
}: LaporanExcelArgs): LaporanExcelResult {

            // ── Number format helper for IDR in Excel ──────────────────────
            const fmtIDR = '"Rp"#,##0';

            const orgHeader = "PRIMKOPPOL RESOR LUMAJANG";
            const unitHeader = `UNIT ${unitLabel.toUpperCase()}`;
            const periodHeader = `Periode: ${allData.periodLabel}`;

            // ── Sheet 1: Transaksi Penjualan (POS) ─────────────────────────
            const txCols = isCuciMobil
                ? ["No.", "Tanggal", "No. Transaksi", "Keterangan", "Plat Nomor", "Anggota/Pelanggan", "Metode", "Nominal", "Status"]
                : ["No.", "Tanggal", "No. Transaksi", "Keterangan", "Anggota/Pelanggan", "Metode", "Nominal", "Status"];

            const allTxForExport = allData.transactions.filter(tx => methodFilters.has(tx.paymentMethod));

            const txRows: any[][] = [
                [orgHeader],
                [unitHeader],
                ["LAPORAN TRANSAKSI PENJUALAN"],
                [periodHeader],
                [],
                txCols,
            ];

            allTxForExport.forEach((tx, i) => {
                const row: any[] = [
                    i + 1,
                    new Date(tx.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }),
                    tx.no,
                    tx.description,
                ];
                if (isCuciMobil) row.push(tx.vehiclePlate || "-");
                row.push(
                    tx.memberName || "-",
                    METHOD_LABEL[tx.paymentMethod] || tx.paymentMethod,
                    { v: tx.amount, t: "n", z: fmtIDR },
                    tx.status === "completed" ? "Selesai" : tx.status,
                );
                txRows.push(row);
            });

            const txColWidths = isCuciMobil
                ? [5, 14, 24, 30, 14, 22, 12, 18, 10]
                : [5, 14, 24, 30, 22, 12, 18, 10];

            const ws1 = XLSX.utils.aoa_to_sheet(txRows);
            ws1["!cols"] = txColWidths.map(w => ({ wch: w }));
            // Merge org header across all columns
            const mergeCount = txCols.length - 1;
            ws1["!merges"] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: mergeCount } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: mergeCount } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: mergeCount } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: mergeCount } },
            ];

            // ── Sheet 2: Pengeluaran Operasional ──────────────────────────
            const expData = allData.operationalExpenses || [];
            const expRows: any[][] = [
                [orgHeader],
                [unitHeader],
                ["LAPORAN PENGELUARAN OPERASIONAL"],
                [periodHeader],
                [],
                ["No.", "Tanggal", "No. Transaksi", "Keterangan", "Jenis", "Metode", "Nominal"],
            ];

            expData.forEach((exp, i) => {
                expRows.push([
                    i + 1,
                    new Date(exp.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }),
                    exp.transactionNo,
                    exp.description,
                    exp.category === "hpp_toko" ? "Belanja Barang"
                        : exp.category === "belanja_aset" ? "Belanja Aset"
                        : "Operasional",
                    METHOD_LABEL[exp.paymentMethod || "cash"] || "Tunai",
                    { v: exp.amount, t: "n", z: fmtIDR },
                ]);
            });
            // Total row
            const totalExpense = expData.reduce((s, e) => s + e.amount, 0);
            expRows.push([]);
            expRows.push(["", "", "", "TOTAL PENGELUARAN (SEMUA JENIS)", "", "", { v: totalExpense, t: "n", z: fmtIDR }]);

            const ws2 = XLSX.utils.aoa_to_sheet(expRows);
            ws2["!cols"] = [5, 14, 26, 35, 16, 12, 18].map(w => ({ wch: w }));
            ws2["!merges"] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 6 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 6 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 6 } },
            ];

            // ── Sheet 3: Pemasukan Operasional ────────────────────────────
            const incData = allData.operationalIncomes || [];
            const incRows: any[][] = [
                [orgHeader],
                [unitHeader],
                ["LAPORAN PEMASUKAN OPERASIONAL"],
                [periodHeader],
                [],
                ["No.", "Tanggal", "No. Transaksi", "Keterangan", "Metode", "Nominal"],
            ];

            incData.forEach((inc, i) => {
                incRows.push([
                    i + 1,
                    new Date(inc.date).toLocaleDateString("id-ID", { timeZone: "Asia/Jakarta" }),
                    inc.transactionNo,
                    inc.description,
                    METHOD_LABEL[inc.paymentMethod || "cash"] || "Tunai",
                    { v: inc.amount, t: "n", z: fmtIDR },
                ]);
            });
            const totalIncome = incData.reduce((s, e) => s + e.amount, 0);
            incRows.push([]);
            incRows.push(["", "", "", "TOTAL PEMASUKAN OPERASIONAL", "", { v: totalIncome, t: "n", z: fmtIDR }]);

            const ws3 = XLSX.utils.aoa_to_sheet(incRows);
            ws3["!cols"] = [5, 14, 26, 35, 12, 18].map(w => ({ wch: w }));
            ws3["!merges"] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 5 } },
            ];

            // ── Sheet 4: Ringkasan Keuangan ────────────────────────────────
            const summaryRows: any[][] = [
                [orgHeader],
                [unitHeader],
                ["RINGKASAN KEUANGAN"],
                [periodHeader],
                [],
                ["Keterangan", "", "Nominal"],
            ];

            if (isCuciMobil) {
                const cmBagiKaryawan = Math.floor(allData.summary.totalPendapatan * 0.5);
                const cmBagianKoperasiKotor = allData.summary.totalPendapatan - cmBagiKaryawan;
                const cmPotonganSHU = allData.summary.potonganSHUMember;
                const cmLabaBersih = cmBagianKoperasiKotor - allData.summary.totalPengeluaran - cmPotonganSHU + allData.summary.totalPemasukan;

                summaryRows.push(
                    ["Total Pendapatan Kotor (Penjualan)", "", { v: allData.summary.totalPendapatan, t: "n", z: fmtIDR }],
                    ["  ├ Tunai", "", { v: allData.summary.tunai, t: "n", z: fmtIDR }],
                    ["  ├ QRIS", "", { v: allData.summary.qris, t: "n", z: fmtIDR }],
                    ["  └ Potong Gaji", "", { v: allData.summary.potongGaji, t: "n", z: fmtIDR }],
                    ["Bagi Hasil Karyawan (50%)", "", { v: -cmBagiKaryawan, t: "n", z: fmtIDR }],
                    ["Bagian Koperasi (Kotor)", "", { v: cmBagianKoperasiKotor, t: "n", z: fmtIDR }],
                );
                if (allData.summary.totalPemasukan > 0) {
                    summaryRows.push(["Pemasukan Operasional", "", { v: allData.summary.totalPemasukan, t: "n", z: fmtIDR }]);
                }
                summaryRows.push(["Total Pengeluaran Operasional", "", { v: -allData.summary.totalPengeluaran, t: "n", z: fmtIDR }]);
                if (cmPotonganSHU > 0) {
                    summaryRows.push([`Potongan SHU Langsung (${allData.summary.jumlahCuciAnggota} cuci × Rp${allData.summary.shuPerCuci.toLocaleString("id-ID")})`, "", { v: -cmPotonganSHU, t: "n", z: fmtIDR }]);
                }
                summaryRows.push(
                    [],
                    ["LABA BERSIH KOPERASI", "", { v: cmLabaBersih, t: "n", z: fmtIDR }],
                );
            } else {
                summaryRows.push(
                    ["Total Pendapatan (Penjualan)", "", { v: allData.summary.totalPendapatan, t: "n", z: fmtIDR }],
                );
                if (usesStoreSales && allData.summary.totalHPP > 0) {
                    summaryRows.push(["HPP (Harga Pokok Penjualan)", "", { v: -allData.summary.totalHPP, t: "n", z: fmtIDR }]);
                }
                if (usesStoreSales && allData.summary.totalWriteOff > 0) {
                    summaryRows.push(["Write-off Stok (Rusak/Kedaluwarsa)", "", { v: -allData.summary.totalWriteOff, t: "n", z: fmtIDR }]);
                }
                summaryRows.push(
                    ["Total Pengeluaran Operasional", "", { v: -allData.summary.totalPengeluaran, t: "n", z: fmtIDR }],
                );
                if (allData.summary.totalPemasukan > 0) {
                    summaryRows.push(["Total Pemasukan Operasional", "", { v: allData.summary.totalPemasukan, t: "n", z: fmtIDR }]);
                }
                summaryRows.push(
                    [],
                    ["LABA BERSIH", "", { v: usesStoreSales ? allData.summary.netProfit : allData.summary.laba, t: "n", z: fmtIDR }],
                );
            }

            const ws4 = XLSX.utils.aoa_to_sheet(summaryRows);
            ws4["!cols"] = [{ wch: 40 }, { wch: 5 }, { wch: 20 }];
            ws4["!merges"] = [
                { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
                { s: { r: 1, c: 0 }, e: { r: 1, c: 2 } },
                { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } },
                { s: { r: 3, c: 0 }, e: { r: 3, c: 2 } },
            ];

            // ── Build workbook with all sheets ─────────────────────────────
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws1, "Transaksi Penjualan");
            if (expData.length > 0) XLSX.utils.book_append_sheet(wb, ws2, "Pengeluaran Operasional");
            if (incData.length > 0) XLSX.utils.book_append_sheet(wb, ws3, "Pemasukan Operasional");
            XLSX.utils.book_append_sheet(wb, ws4, "Ringkasan Keuangan");

            // ── Sheet 5: Laba per Produk (harga jual − HPP) — unit ber-StoreSale ──
            if (usesStoreSales && allData.productProfit && allData.productProfit.length > 0) {
                // Sanitasi formula injection: nama produk bisa diawali = + @ -
                const safe = (s: string) => ( /^[=+@-]/.test(s) ? `'${s}` : s);
                const ppTotals = allData.productProfit.reduce(
                    (acc, r) => ({ qty: acc.qty + r.qty, omzet: acc.omzet + r.omzet, hpp: acc.hpp + r.hpp, laba: acc.laba + r.laba }),
                    { qty: 0, omzet: 0, hpp: 0, laba: 0 },
                );
                const ppRows: any[][] = [
                    [orgHeader],
                    [unitHeader],
                    ["LABA PER PRODUK (HARGA JUAL − HPP)"],
                    [periodHeader],
                    [],
                    ["Produk", "Qty Terjual", "Omzet (Harga Jual)", "HPP", "Laba", "Margin %"],
                    ...allData.productProfit.map((r) => [
                        safe(r.name),
                        r.qty,
                        { v: r.omzet, t: "n", z: fmtIDR },
                        { v: r.hpp, t: "n", z: fmtIDR },
                        { v: r.laba, t: "n", z: fmtIDR },
                        { v: +(r.margin * 100).toFixed(2), t: "n", z: "0.00" },
                    ]),
                    [],
                    ["TOTAL", ppTotals.qty, { v: ppTotals.omzet, t: "n", z: fmtIDR }, { v: ppTotals.hpp, t: "n", z: fmtIDR }, { v: ppTotals.laba, t: "n", z: fmtIDR }],
                ];
                const ws5 = XLSX.utils.aoa_to_sheet(ppRows);
                ws5["!cols"] = [{ wch: 32 }, { wch: 10 }, { wch: 20 }, { wch: 18 }, { wch: 18 }, { wch: 10 }];
                XLSX.utils.book_append_sheet(wb, ws5, "Laba per Produk");
            }

    
        const safeName = unitLabel.replace(/[^a-zA-Z0-9]/g, "_");
        return {
            wb,
            filename: `Laporan_${safeName}_${allData.periodLabel}.xlsx`,
            txCount: allTxForExport.length,
            expCount: expData.length,
            incCount: incData.length,
        };
}
