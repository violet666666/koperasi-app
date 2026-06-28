/**
 * Deteksi anomali kualitas data yang mendistorsi SHU/Neraca.
 * Spec: docs/superpowers/specs/2026-06-27-anomali-detection-design.md
 *
 * PURE core (helpers + builders) di file ini — unit-testable.
 * DB detectors + orchestrator ditambahkan di Task 2.
 */
import { CASH_BANK_CATEGORIES } from "@/lib/constants";
import type { CategoryMismatch } from "./cash-bank-category-guard";
import { detectCategoryMismatch } from "./cash-bank-category-guard";
import type { PrismaClient } from "@prisma/client";

export type DetectorId = "D1" | "D2" | "D3" | "D4" | "D5";
export type Severity = "high" | "medium" | "low";
export type ImpactDirection = "inflates_beban" | "inflates_income" | "distorts_neraca" | "none";

export interface Anomaly {
    id: string;
    detector: DetectorId;
    severity: Severity;
    title: string;
    description: string;
    entityType: "cashbank_tx" | "cashbank_account";
    entityId: number;
    entityLabel: string;
    amount: number;
    estimatedShuImpact: number;
    impactDirection: ImpactDirection;
    suggestedAction: string;
}

export interface AnomalyScanResult {
    anomalies: Anomaly[];
    summary: {
        total: number;
        bySeverity: Record<Severity, number>;
        totalShuImpact: number;
        period: { year: number; month: number | null };
        scannedAt: string;
    };
}

// ── Konstanta konfigurable (spec §6) ──────────────────────────────────────
export const OUTLIER_FLOOR = 50_000_000;
export const UNJOURNALED_FLOOR = 25_000_000;

export const EXPENSE_CATEGORIES_AT_RISK = ["biaya_operasional", "beban_unit", "hpp_toko", "hutang_mitra"] as const;

// DRY: derive dari sumber canonical, bukan hardcode duplikat.
export const KNOWN_CATEGORIES = new Set(Object.keys(CASH_BANK_CATEGORIES));

// Kategori sistem/legacy yang ditulis subsystem lain (SHU calc, void reversal,
// billing settlement, loan penalty) tapi BUKAN bagian dropdown UI CASH_BANK_CATEGORIES
// (yang cuma 13 key). Sumber: diagnose-anomali-breakdown.ts — 4.343 tx legit di 2026
// pakai kategori ini. Tanpa superset ini, D4 akan menflag tx legit sebagai "tidak dikenal".
export const SYSTEM_CB_CATEGORIES = [
    "pendapatan_toko",       // revenue toko (StoreSale) — dipakai SHU calc
    "operational",           // pendapatan operasional unit
    "savings",               // setoran simpanan (shorthand)
    "penalti_pelunasan",     // denda pelunasan dini pinjaman
    "void_penjualan_toko",   // reversal void StoreSale
    "void_unit_transaction", // reversal void UnitTransaction
    "salary_cut_settlement", // settlement billing potong-gaji
] as const;

// Superset "kategori valid" = UI enum ∪ sistem/legacy. D4 memakai ini, BUKAN
// KNOWN_CATEGORIES, supaya typo/garbage masa depan tetap ke-flag tanpa false-positive
// pada kategori legit yang sudah dipakai ribuan tx.
export const VALID_CB_CATEGORIES = new Set<string>([...KNOWN_CATEGORIES, ...SYSTEM_CB_CATEGORIES]);

// ── Tipe row bersama ──────────────────────────────────────────────────────
export interface TxRow {
    id: number;
    transactionNo: string;
    amount: any;
    category: string | null;
    description: string | null;
    transactionDate: Date;
}
export interface AccountRow {
    id: number;
    code: string;
    name: string;
    currentBalance: any;
}

// ── Pure helpers ──────────────────────────────────────────────────────────
export function toNum(d: any): number {
    if (d === null || d === undefined) return 0;
    return typeof d === "number" ? d : Number(String(d));
}

export function isKnownCategory(category: string | null | undefined): boolean {
    return !!category && KNOWN_CATEGORIES.has(category);
}

// Valid = ada di superset (UI enum ∪ sistem/legacy). Dipakai D4.
export function isValidCategory(category: string | null | undefined): boolean {
    return !!category && VALID_CB_CATEGORIES.has(category);
}

export function isOutlier(amount: number): boolean {
    return amount >= OUTLIER_FLOOR;
}

export function makeAnomalyId(detector: DetectorId, entityType: string, entityId: number): string {
    return `${detector}-${entityType}-${entityId}`;
}

export function computeMedian(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ── Builders (pure mappers) ───────────────────────────────────────────────
export function buildD1Anomaly(tx: TxRow, mismatch: Pick<CategoryMismatch, "suggestedCategory">): Anomaly {
    const amt = toNum(tx.amount);
    const kind = mismatch.suggestedCategory === "transfer" ? "transfer" : "pencairan pinjaman";
    const label = mismatch.suggestedCategory === "transfer" ? "Transfer Antar Kas/Bank" : "Pencairan Pinjaman";
    return {
        id: makeAnomalyId("D1", "cashbank_tx", tx.id),
        detector: "D1",
        severity: "high",
        title: `Salah kategori: ${kind} dicatat sebagai ${tx.category}`,
        description: `Transaksi ${tx.transactionNo} "${tx.description ?? ""}" sebesar Rp ${amt.toLocaleString("id-ID")} dikategorikan ${tx.category}, namun deskripsi mengindikasikan ${kind}. Kategori expense ini menggelembungkan beban SHU.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: amt,
        impactDirection: "inflates_beban",
        suggestedAction: `Reklassifikasi ke ${label}`,
    };
}

export function buildD2Anomaly(a: AccountRow): Anomaly {
    const bal = toNum(a.currentBalance);
    return {
        id: makeAnomalyId("D2", "cashbank_account", a.id),
        detector: "D2",
        severity: "high",
        title: `Saldo akun negatif: ${a.name}`,
        description: `Akun ${a.name} (${a.code}) memiliki saldo Rp ${bal.toLocaleString("id-ID")}. Saldo negatif mengindikasikan error pencatatan/transaksi ganda.`,
        entityType: "cashbank_account",
        entityId: a.id,
        entityLabel: `${a.code} • ${a.name} • saldo Rp ${bal.toLocaleString("id-ID")}`,
        amount: Math.abs(bal),
        estimatedShuImpact: 0,
        impactDirection: "distorts_neraca",
        suggestedAction: "Audit transaksi akun ini; saldo negatif = error/pencatatan ganda",
    };
}

export function buildD3Anomaly(tx: TxRow): Anomaly {
    const amt = toNum(tx.amount);
    return {
        id: makeAnomalyId("D3", "cashbank_tx", tx.id),
        detector: "D3",
        severity: "medium",
        title: `Transaksi outlier: Rp ${amt.toLocaleString("id-ID")}`,
        description: `Transaksi ${tx.transactionNo} "${tx.description ?? ""}" sebesar Rp ${amt.toLocaleString("id-ID")} (≥ Rp ${OUTLIER_FLOOR.toLocaleString("id-ID")} floor). Jauh di atas transaksi tipikal — review manual.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Review manual — nilai jauh di atas transaksi tipikal",
    };
}

export function buildD4Anomaly(tx: TxRow): Anomaly {
    const amt = toNum(tx.amount);
    const cat = tx.category ?? "(null)";
    return {
        id: makeAnomalyId("D4", "cashbank_tx", tx.id),
        detector: "D4",
        severity: "medium",
        title: `Kategori tak terdaftar: "${cat}"`,
        description: `Transaksi ${tx.transactionNo} punya kategori "${cat}" yang tidak ada di daftar kategori valid.`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Tetapkan kategori yang valid",
    };
}

export function buildD5Anomaly(tx: TxRow): Anomaly {
    const amt = toNum(tx.amount);
    return {
        id: makeAnomalyId("D5", "cashbank_tx", tx.id),
        detector: "D5",
        severity: "low",
        title: `Transaksi besar belum dijurnal: Rp ${amt.toLocaleString("id-ID")}`,
        description: `Transaksi keluar ${tx.transactionNo} sebesar Rp ${amt.toLocaleString("id-ID")} belum memiliki jurnal akuntansi (journalId=null).`,
        entityType: "cashbank_tx",
        entityId: tx.id,
        entityLabel: `${tx.transactionNo} • Rp ${amt.toLocaleString("id-ID")} • ${tx.transactionDate.toISOString().slice(0, 10)}`,
        amount: amt,
        estimatedShuImpact: 0,
        impactDirection: "none",
        suggestedAction: "Verifikasi apakah perlu dijurnal",
    };
}

// ── Orchestrator helpers (period + summary) ───────────────────────────────
const TX_SELECT = { id: true, transactionNo: true, amount: true, category: true, description: true, transactionDate: true } as const;

function buildPeriod(year: number, month: number | null) {
    if (month) {
        return {
            startDate: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0)),
            endDate: new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)),
        };
    }
    return {
        startDate: new Date(Date.UTC(year, 0, 1, 0, 0, 0)),
        endDate: new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)),
    };
}

export const SEVERITY_RANK: Record<Severity, number> = { high: 0, medium: 1, low: 2 };

export function summarizeAnomalies(anomalies: Anomaly[], period: { year: number; month: number | null }): AnomalyScanResult["summary"] {
    const bySeverity: Record<Severity, number> = { high: 0, medium: 0, low: 0 };
    let totalShuImpact = 0;
    for (const a of anomalies) {
        bySeverity[a.severity]++;
        totalShuImpact += a.estimatedShuImpact;
    }
    return { total: anomalies.length, bySeverity, totalShuImpact, period, scannedAt: new Date().toISOString() };
}

// ── DB detectors ──────────────────────────────────────────────────────────
export async function detectD1(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, category: { in: [...EXPENSE_CATEGORIES_AT_RISK] } },
        select: TX_SELECT,
    });
    const out: Anomaly[] = [];
    for (const tx of txs) {
        const m = detectCategoryMismatch("out", tx.category, tx.description);
        if (m) out.push(buildD1Anomaly(tx as TxRow, m));
    }
    return out;
}

export async function detectD2(prisma: PrismaClient): Promise<Anomaly[]> {
    const accts = await prisma.cashBankAccount.findMany({
        where: { currentBalance: { lt: 0 } },
        select: { id: true, code: true, name: true, currentBalance: true },
    });
    return accts.map((a) => buildD2Anomaly(a as AccountRow));
}

export async function detectD3(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    // KEPUTUSAN BERBASIS DATA (diagnose-anomali-breakdown.ts, 2026): floor-only, TANPA
    // cek relatif median. Median tx 2026 = Rp 38.500 → ambang lama `>10×median` = Rp 385k
    // menflag 741 tx normal (hampir semua tx operasional di atas 385k) = sumber false-positive
    // 5103 yang diperbaiki commit ec44b21. Floor Rp 50jt ≈ p99+ (46 tx) = ambang outlier
    // absolut yang sehat untuk D3 (impact=0, cuma prompt "review manual"). Jangan restore
    // cek median tanpa ambang absolut kedua — akan reintroduksi noise. computeMedian()
    // tetap di-export sebagai utilitas murni, bukan karena D3 memakainya.
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, amount: { gte: OUTLIER_FLOOR } },
        select: TX_SELECT,
    });
    return txs.map((t) => buildD3Anomaly(t as TxRow));
}

export async function detectD4(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    // Tangkap DUA kategori masalah: (1) category=null (tidak dikategorikan), dan
    // (2) category non-null tapi typo/garbage di luar VALID_CB_CATEGORIES superset.
    // Filter di DB-level (bukan in-memory filter) demi performa.
    // Catatan SQL: branch `{ category: null }` wajib karena `NOT IN` tidak match NULL.
    // Sebelumnya (commit ec44b21) cuma tangkap null → typo non-null lolos. Restore scope
    // pakai superset supaya 4.343 tx legit (pendapatan_toko dll) tidak ikut di-flag.
    const txs = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            OR: [{ category: null }, { category: { notIn: [...VALID_CB_CATEGORIES] } }],
        },
        select: TX_SELECT,
    });
    return txs.map((t) => buildD4Anomaly(t as TxRow));
}

export async function detectD5(prisma: PrismaClient, startDate: Date, endDate: Date): Promise<Anomaly[]> {
    const txs = await prisma.cashBankTransaction.findMany({
        where: { transactionDate: { gte: startDate, lte: endDate }, type: "out", journalId: null, amount: { gte: UNJOURNALED_FLOOR } },
        select: TX_SELECT,
    });
    return txs.map((t) => buildD5Anomaly(t as TxRow));
}

// ── Orchestrator ──────────────────────────────────────────────────────────
export async function scanAnomalies(prisma: PrismaClient, year: number, month: number | null = null): Promise<AnomalyScanResult> {
    const { startDate, endDate } = buildPeriod(year, month);
    const period = { year, month };
    let anomalies: Anomaly[] = [];

    // Tiap detector di-try-catch: satu gagal ≠ seluruh scan hancur.
    const runners: [string, () => Promise<Anomaly[]>][] = [
        ["D1", () => detectD1(prisma, startDate, endDate)],
        ["D2", () => detectD2(prisma)],
        ["D3", () => detectD3(prisma, startDate, endDate)],
        ["D4", () => detectD4(prisma, startDate, endDate)],
        ["D5", () => detectD5(prisma, startDate, endDate)],
    ];
    for (const [name, run] of runners) {
        try {
            anomalies = anomalies.concat(await run());
        } catch (e) {
            console.error(`[anomali] detector ${name} gagal:`, e);
        }
    }

    anomalies.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || b.amount - a.amount);
    return { anomalies, summary: summarizeAnomalies(anomalies, period) };
}
