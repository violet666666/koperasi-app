import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { buildLaporanExcel } from "../app/(protected)/unit/[unitSlug]/laporan/_lib/export-excel";
import type { LaporanData } from "../app/(protected)/unit/[unitSlug]/laporan/_types";

function fixture(overrides: Partial<LaporanData> = {}): LaporanData {
    return {
        unitType: "toko",
        unitSlug: "toko",
        periodLabel: "Oktober 2026",
        dateFrom: "2026-10-01",
        dateTo: "2026-10-31",
        summary: {
            totalPendapatan: 300000, totalTransaksi: 3, tunai: 100000, qris: 200000,
            potongGaji: 0, dineIn: 0, takeaway: 0, counter: 0, dineInCount: 0,
            takeawayCount: 0, counterCount: 0, takeawaySurchargeTotal: 0,
            totalPengeluaran: 50000, totalPembelianStok: 0, totalBelanjaAset: 0,
            totalPemasukan: 10000, potonganSHUMember: 0, jumlahCuciAnggota: 0,
            shuPerCuci: 0, laba: 260000, totalHPP: 30000, totalWriteOff: 0,
            netProfit: 230000,
        },
        transactions: [
            { id: "1", date: "2026-10-05T10:00:00Z", no: "TK-1", description: "Sabun", memberName: null, memberNrp: null, paymentMethod: "cash", amount: 100000, status: "completed", type: "store_sale", vehiclePlate: null },
            { id: "2", date: "2026-10-06T11:00:00Z", no: "TK-2", description: "Minyak", memberName: "Budi", memberNrp: "123", paymentMethod: "qris", amount: 200000, status: "completed", type: "store_sale", vehiclePlate: null },
            { id: "3", date: "2026-10-07T12:00:00Z", no: "TK-3", description: "Ditolak metode", memberName: null, memberNrp: null, paymentMethod: "salary_cut", amount: 999, status: "completed", type: "store_sale", vehiclePlate: null },
        ],
        pagination: { page: 1, perPage: 50, total: 3, totalPages: 1 },
        operationalExpenses: [
            { id: 1, date: "2026-10-03T02:00:00Z", transactionNo: "EXP-1", description: "Plastik", amount: 50000, receiptImagePath: null, paymentMethod: "cash", category: "operational" },
        ],
        operationalIncomes: [
            { id: 2, date: "2026-10-04T02:00:00Z", transactionNo: "INC-1", description: "Sewa", amount: 10000, receiptImagePath: null, paymentMethod: "qris", category: null },
        ],
        productProfit: [
            { productId: 1, name: "=EVIL() + 1", qty: 2, omzet: 200000, hpp: 100000, laba: 100000, margin: 0.5 },
        ],
        ...overrides,
    };
}

describe("buildLaporanExcel", () => {
    it("membuat sheet wajib + menghormati methodFilters", () => {
        const { wb, txCount } = buildLaporanExcel({
            XLSX, allData: fixture(),
            unitLabel: "Toko PRIMKOPPOL", isCuciMobil: false, usesStoreSales: true,
            methodFilters: new Set(["cash", "qris"]),
        });
        expect(wb.SheetNames).toContain("Transaksi Penjualan");
        expect(wb.SheetNames).toContain("Pengeluaran Operasional");
        expect(wb.SheetNames).toContain("Pemasukan Operasional");
        expect(wb.SheetNames).toContain("Ringkasan Keuangan");
        expect(wb.SheetNames).toContain("Laba per Produk");
        // salary_cut dikecualikan filter
        expect(txCount).toBe(2);
        const ws = wb.Sheets["Transaksi Penjualan"];
        const csv = XLSX.utils.sheet_to_csv(ws);
        expect(csv).toContain("TK-1");
        expect(csv).toContain("TK-2");
        expect(csv).not.toContain("TK-3");
    });

    it("filename tersanitasi dari karakter non-alfanumerik", () => {
        const { filename } = buildLaporanExcel({
            XLSX, allData: fixture(),
            unitLabel: "Resto & Cafe Latar!", isCuciMobil: false, usesStoreSales: true,
            methodFilters: new Set(["cash"]),
        });
        expect(filename).toBe("Laporan_Resto___Cafe_Latar__Oktober 2026.xlsx");
    });

    it("sheet pengeluaran punya baris TOTAL = jumlah amount", () => {
        const { wb } = buildLaporanExcel({
            XLSX, allData: fixture(),
            unitLabel: "Toko", isCuciMobil: false, usesStoreSales: true,
            methodFilters: new Set(["cash"]),
        });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Pengeluaran Operasional"]);
        expect(csv).toContain("TOTAL PENGELUARAN (SEMUA JENIS)");
        expect(csv).toContain("Rp50,000"); // cell ber-format '"Rp"#,##0'
    });

    it("sanitasi formula injection pada nama produk (= + @ -)", () => {
        const { wb } = buildLaporanExcel({
            XLSX, allData: fixture(),
            unitLabel: "Toko", isCuciMobil: false, usesStoreSales: true,
            methodFilters: new Set(["cash"]),
        });
        const csv = XLSX.utils.sheet_to_csv(wb.Sheets["Laba per Produk"]);
        expect(csv).toContain("'=EVIL() + 1");
    });

    it("mode cuci_mobil: sheet ringkasan 50/50 + kolom plat di transaksi", () => {
        const { wb } = buildLaporanExcel({
            XLSX, allData: fixture({ unitType: "cuci_mobil", unitSlug: "cuci-mobil",
                transactions: fixture().transactions.map(t => ({ ...t, vehiclePlate: "B 1234 XYZ" })) }),
            unitLabel: "Cuci Mobil", isCuciMobil: true, usesStoreSales: false,
            methodFilters: new Set(["cash", "qris"]),
        });
        const tx = XLSX.utils.sheet_to_csv(wb.Sheets["Transaksi Penjualan"]);
        expect(tx).toContain("Plat Nomor");
        expect(tx).toContain("B 1234 XYZ");
        const sum = XLSX.utils.sheet_to_csv(wb.Sheets["Ringkasan Keuangan"]);
        expect(sum).toContain("Bagi Hasil Karyawan (50%)");
        expect(sum).toContain("LABA BERSIH KOPERASI");
        // unit non-StoreSale: tidak ada sheet Laba per Produk
        expect(wb.SheetNames).not.toContain("Laba per Produk");
    });
});
