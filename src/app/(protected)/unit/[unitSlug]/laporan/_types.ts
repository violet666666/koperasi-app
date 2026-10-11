// ── Types ───────────────────────────────────────────────────────────────────
export interface LaporanTransaction {
    id: string;
    date: string;
    no: string;
    description: string;
    memberName: string | null;
    memberNrp: string | null;
    paymentMethod: string;
    amount: number;
    status: string;
    type: string;
    vehiclePlate: string | null;
}

export interface LaporanSummary {
    totalPendapatan: number;
    totalTransaksi: number;
    tunai: number;
    qris: number;
    potongGaji: number;
    dineIn: number;
    takeaway: number;
    counter: number;
    dineInCount: number;
    takeawayCount: number;
    counterCount: number;
    takeawaySurchargeTotal: number;
    totalPengeluaran: number;
    totalPembelianStok: number; // kategori hpp_toko — diakui via HPP, bukan beban laba
    totalBelanjaAset: number;   // kategori belanja_aset — capex
    totalPemasukan: number;
    potonganSHUMember: number;
    jumlahCuciAnggota: number;
    shuPerCuci: number;
    laba: number;
    totalHPP: number;
    totalWriteOff: number;
    netProfit: number;
}

export interface ProductProfitRow {
    productId: number;
    name: string;
    qty: number;
    omzet: number;
    hpp: number;
    laba: number;
    margin: number;
}

export interface PaginationInfo {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
}

export interface OperationalExpense {
    id: number;
    date: string;
    transactionNo: string;
    description: string;
    amount: number;
    receiptImagePath?: string | null;
    paymentMethod?: string | null;
    category?: string | null;
}

export interface LaporanData {
    unitType: string;
    unitSlug: string;
    periodLabel: string;
    dateFrom: string;
    dateTo: string;
    summary: LaporanSummary;
    transactions: LaporanTransaction[];
    pagination: PaginationInfo;
    operationalExpenses: OperationalExpense[];
    operationalIncomes: OperationalExpense[]; // Same shape as expense
    productProfit?: ProductProfitRow[]; // Laba per produk (harga jual − HPP), unit ber-StoreSale saja
}

