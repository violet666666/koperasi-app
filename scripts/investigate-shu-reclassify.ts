/**
 * INVESTIGASI (read-only) sebelum reklassifikasi 3 transaksi SHU.
 *
 * Pertanyaan kunci yang harus terjawab sebelum menyentuh data:
 *  1. Apakah "ambil kas bri" (Rp 500jt) & "ambil tunai" (Rp 100jt) BENAR-BENAR
 *     transfer (ada deposit lawan jenis di kas)? Atau uangnya benar-benar keluar?
 *  2. Apakah "pinjam SP ZULFAN" (Rp 20jt) punya Loan lawan & referenceId?
 *  3. (Kekhawatiran atasan) Adakah anggota dengan kontribusi/SHU outlier?
 *
 * Usage:
 *   NODE_ENV=production npx tsx --env-file=.env scripts/investigate-shu-reclassify.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({ log: ["error"] });
const rp = (n: any) => "Rp " + Math.round(Number(String(n))).toLocaleString("id-ID");
const toNum = (d: any) => (d === null || d === undefined ? 0 : Number(String(d)));

async function main() {
    const year = 2026;
    const startDate = new Date(Date.UTC(year, 0, 1));
    const endDate = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999));

    // ── 3 transaksi target: cari by deskripsi unik + jumlah ──
    const targets = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            category: "biaya_operasional",
            description: { contains: "ambil kas bri", mode: "insensitive" },
        },
        select: { id: true, transactionNo: true, description: true, amount: true, transactionDate: true },
    });
    const ambilTunai = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            description: { contains: "ambil tunai", mode: "insensitive" },
        },
        select: { id: true, transactionNo: true, description: true, amount: true, transactionDate: true, category: true },
    });
    const pinjamSp = await prisma.cashBankTransaction.findMany({
        where: {
            transactionDate: { gte: startDate, lte: endDate },
            type: "out",
            description: { contains: "pinjam SP ZULFAN", mode: "insensitive" },
        },
        select: { id: true, transactionNo: true, description: true, amount: true, transactionDate: true, category: true },
    });

    const allTargets = [...targets, ...ambilTunai, ...pinjamSp];
    console.log("\n" + "=".repeat(80));
    console.log(" BAGIAN A — 3 TRANSAKSI TARGET (record lengkap)");
    console.log("=".repeat(80));
    for (const t of allTargets) {
        const full = await prisma.cashBankTransaction.findUnique({
            where: { id: t.id },
            include: { account: { select: { id: true, name: true, type: true } } },
        });
        console.log(`\nID ${t.id} | ${t.transactionNo}`);
        console.log(`  Tgl        : ${t.transactionDate.toISOString().slice(0, 10)}`);
        console.log(`  Amount     : ${rp(t.amount)}`);
        console.log(`  Desc       : "${t.description}"`);
        console.log(`  Category   : ${full!.category}`);
        console.log(`  Account    : id=${full!.accountId} | ${full!.account.name} (${full!.account.type})`);
        console.log(`  RefType/Id : ${full!.referenceType ?? "-"} / ${full!.referenceId ?? "-"}`);
        console.log(`  JournalId  : ${full!.journalId ?? "- (belum dijurnal)"}`);
        console.log(`  MemberId   : ${full!.memberId ?? "-"}`);
        console.log(`  Balance    : ${rp(full!.balanceBefore)} → ${rp(full!.balanceAfter)} (Δ ${rp(toNum(full!.balanceBefore) - toNum(full!.balanceAfter))})`);

        // ── Cari counterpart: transaksi lawan jenis ±3 hari, amount mirip ──
        const amt = toNum(t.amount);
        const dt = t.transactionDate;
        const lo = new Date(dt); lo.setUTCDate(lo.getUTCDate() - 3);
        const hi = new Date(dt); hi.setUTCDate(hi.getUTCDate() + 3);
        const counterpart = await prisma.cashBankTransaction.findMany({
            where: {
                transactionDate: { gte: lo, lte: hi },
                type: "in",
                amount: { gte: amt * 0.95, lte: amt * 1.05 },
                id: { not: t.id },
            },
            select: { id: true, transactionNo: true, amount: true, transactionDate: true, category: true, accountId: true, description: true },
        });
        if (counterpart.length > 0) {
            console.log(`  → COUNTERPART type=in ditemukan (${counterpart.length}):`);
            counterpart.forEach((c) => console.log(`      • id=${c.id} ${c.transactionDate.toISOString().slice(0, 10)} ${rp(c.amount)} [${c.category}] acct=${c.accountId} "${c.description?.slice(0, 50)}"`));
        } else {
            console.log(`  → ❌ TIDAK ADA counterpart type=in (±3 hari, ±5%). Uang ini mungkin BENAR-BENAR keluar.`);
        }
    }

    // ── Cek Loan ZULFAN ──
    console.log("\n" + "=".repeat(80));
    console.log(" BAGIAN B — LOAN UNTUK ZULFAN WASIS (validasi 'pinjam SP')");
    console.log("=".repeat(80));
    const zulfanMembers = await prisma.member.findMany({
        where: { OR: [{ name: { contains: "ZULFAN", mode: "insensitive" } }, { memberNo: { contains: "84121427" } }] },
        select: { id: true, memberNo: true, name: true },
    });
    console.log(" Member ZULFAN:", zulfanMembers.map((m) => `${m.memberNo} (id=${m.id})`).join(", ") || "tidak ditemukan");
    if (zulfanMembers.length) {
        const loans = await prisma.loan.findMany({
            where: { memberId: { in: zulfanMembers.map((m) => m.id) }, disbursementDate: { gte: startDate, lte: endDate } },
            select: { id: true, loanNo: true, principalAmount: true, adminFee: true, disbursementDate: true, status: true },
        });
        if (loans.length) {
            loans.forEach((l) => console.log(`   Loan id=${l.id} ${l.loanNo} | principal ${rp(l.principal)} | adminFee ${rp(l.adminFee)} | ${l.disbursementDate.toISOString().slice(0, 10)} | ${l.status}`));
        } else {
            console.log("   Tidak ada loan 2026 untuk ZULFAN.");
        }
    }

    // ── Anomali kontribusi anggota (kekhawatiran atasan "SHU kebesaran") ──
    console.log("\n" + "=".repeat(80));
    console.log(" BAGIAN C — DISTRIBUSI KONTRIBUSI USAHA ANGGOTA (cari outlier)");
    console.log("=".repeat(80));
    const members = await prisma.member.findMany({
        where: { status: "active", deletedAt: null },
        select: {
            id: true, memberNo: true, name: true,
            loanPayments: { where: { paymentDate: { gte: startDate, lte: endDate }, status: { not: "voided" } }, select: { interestPortion: true } },
            storeSales: { where: { createdAt: { gte: startDate, lte: endDate } }, select: { totalAmount: true, metadata: true } },
            unitTransactions: { where: { transactionDate: { gte: startDate, lte: endDate }, status: "completed", isPaid: true }, select: { amount: true, unitType: true } },
        },
    });
    const rows = members.map((m) => {
        const loan = m.loanPayments.reduce((s, p) => s + toNum(p.interestPortion), 0);
        const store = m.storeSales.filter((s) => !(s.metadata as any)?.isVoided).reduce((s, p) => s + toNum(p.totalAmount), 0);
        const unit = m.unitTransactions.reduce((s, p) => s + toNum(p.amount), 0);
        return { memberNo: m.memberNo, name: m.name, loan, store, unit, total: loan + store + unit };
    }).sort((a, b) => b.total - a.total);

    const allTotals = rows.map((r) => r.total).filter((x) => x > 0);
    const n = allTotals.length;
    const sorted = [...allTotals].sort((a, b) => a - b);
    const median = sorted[Math.floor(n / 2)] || 0;
    const p90 = sorted[Math.floor(n * 0.9)] || 0;
    const mean = allTotals.reduce((a, b) => a + b, 0) / (n || 1);
    console.log(` Anggota aktif: ${members.length} | yang punya kontribusi >0: ${n}`);
    console.log(` Statistik kontribusi usaha (Rp): mean=${rp(mean)} median=${rp(median)} p90=${rp(p90)} max=${rp(allTotals[0] || 0)}\n`);
    console.log(" TOP 15 kontribusi usaha terbesar (periksa apakah ada yang tidak wajar):");
    rows.slice(0, 15).forEach((r, i) => {
        console.log(`  ${String(i + 1).padStart(2)}. ${r.memberNo} ${r.name.slice(0, 28).padEnd(28)} | toko ${rp(r.store).padStart(14)} | unit ${rp(r.unit).padStart(12)} | bunga ${rp(r.loan).padStart(10)} | TOTAL ${rp(r.total).padStart(15)}`);
    });

    await prisma.$disconnect();
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
