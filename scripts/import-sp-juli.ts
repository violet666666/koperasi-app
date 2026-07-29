/**
 * Import SP_0726JULI.xlsx sheet "GAJI" via vs_sp logic — PREVIEW by default, --commit to write.
 * Reuses @/lib/import-vs-sp-helpers (pure fns) + same matching as api/loans/import-vs-sp.
 *
 *   NODE_ENV=production npx tsx --env-file=.env scripts/import-sp-juli.ts              # PREVIEW (read-only)
 *   NODE_ENV=production npx tsx --env-file=.env scripts/import-sp-juli.ts --commit      # WRITE
 */
import prisma from "../src/lib/prisma";
import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
import {
  COL, SUMMARY_KEYWORDS, ROMAWI, MONTH_INDONESIAN,
  cleanNrp, cleanNumber, cleanNameForMatch, parseExcelDate, detectPeriod, detectColumns,
} from "../src/lib/import-vs-sp-helpers";

const COMMIT = process.argv.includes("--commit");
const FILE = "docs/juli-2027/SP_0726JULI.xlsx";
const SHEET = "GAJI";

interface Row {
  nrp: string; nama: string; pangkat: string; pinjam: number; selama: number; jasa: number;
  angsuran: number; potBulan: number; totalBulan: number; jumlahSd: number; sisaSaldo: number;
  tglPinjam: Date | null;
  status: "UPDATE" | "NEW_LOAN" | "NEW_MEMBER" | "SKIP_ZERO" | "ERROR";
  memberId: number | null; memberName: string; loanId: number | null; loanNo: string | null;
  reason: string;
}

async function main() {
  console.log(`=== IMPORT SP JULI | sheet=${SHEET} | mode=${COMMIT ? "COMMIT" : "PREVIEW (read-only)"} ===`);

  // 1. Read file
  const wb = XLSX.readFile(FILE, { type: "file" });
  const sheetName = wb.SheetNames.find(s => s === SHEET) || wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  let rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as (string|number)[][][];
  rows = rows.filter(r => r.some(c => c && String(c).trim() !== ""));
  console.log(`Sheet "${sheetName}": ${rows.length} non-empty rows`);

  const period = detectPeriod(rows);
  if (!period) { console.error("Tidak deteksi periode (PER <tgl> <bulan> <tahun>)."); process.exit(1); }
  // Detect column layout dynamically (file format drifted: SISA SALDO moved col 14 → 15)
  const C = { ...COL, ...detectColumns(rows) };
  console.log(`Periode deteksi: ${MONTH_INDONESIAN[period.monthNum-1]} ${period.year}`);
  console.log(`Kolom deteksi: SISA_SALDO=${C.SISA_SALDO} | JUMLAH_SD=${C.JUMLAH_SD} | TOTAL_BULAN=${C.TOTAL_BULAN}`);

  // 2. Detect first DATA row dynamically (skip headers/sub-headers)
  let startIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const col0 = String(r[0] || "").trim();
    const nama = String(r[COL.NAMA] || "").trim();
    // data row: col0 numeric, NAMA non-empty & not header-ish & not pure numeric
    if (col0 && /^\d+$/.test(col0) && nama && nama.toUpperCase() !== "NAMA" && !/^\d+(\.\d+)?$/.test(nama)) {
      startIdx = i; break;
    }
  }
  if (startIdx === -1) { console.error("Tidak temukan baris data."); process.exit(1); }
  console.log(`First data row at index ${startIdx}. Header sample (idx ${Math.max(0,startIdx-3)}):`);
  console.log("  " + rows[Math.max(0,startIdx-3)].slice(0,15).map((c,i)=>`${String.fromCharCode(65+i)}:${String(c).trim().slice(0,10)}`).join(" | "));

  // 3. Load reference data
  const allMembers = await prisma.member.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, nrp: true, memberNo: true, branchId: true },
  });
  const allLoans = await prisma.loan.findMany({
    where: { status: "active" },
    select: { id: true, loanNo: true, memberId: true, principalAmount: true, principalOutstanding: true, disbursementDate: true, tenorMonths: true },
  });
  const defaultProduct = await prisma.loanProduct.findFirst({ where: { isActive: true } });
  const defaultBranch = (await prisma.branch.findFirst({ where: { isHeadOffice: true, isActive: true } })) || (await prisma.branch.findFirst({ where: { isActive: true } }));
  console.log(`Members: ${allMembers.length} | active loans: ${allLoans.length} | product: ${defaultProduct?.id} | branch: ${defaultBranch?.id}`);

  // 4. Parse + classify
  const results: Row[] = [];
  for (let i = startIdx; i < rows.length; i++) {
    const r = rows[i];
    const rawNama = String(r[COL.NAMA] || "").trim();
    if (!rawNama || rawNama.toUpperCase() === "NAMA" || rawNama === "0") continue;
    if (/^\d+(\.\d+)?$/.test(rawNama)) continue;
    if (SUMMARY_KEYWORDS.some(kw => rawNama.toUpperCase().includes(kw))) continue;

    const nrp = cleanNrp(r[COL.NRP] as string);
    const pinjam = cleanNumber(r[COL.PINJAM] as string);
    if (pinjam <= 0) {
      results.push({ nrp: nrp||"-", nama: rawNama, pangkat: String(r[COL.PANGKAT]||"").trim(), pinjam:0, selama:0, jasa:0, angsuran:0, potBulan:0, totalBulan:0, jumlahSd:0, sisaSaldo:0, tglPinjam:null, status:"SKIP_ZERO", memberId:null, memberName:rawNama, loanId:null, loanNo:null, reason:"Pinjam ≤ 0" });
      continue;
    }
    const selama = cleanNumber(r[COL.SELAMA] as string) || 12;
    const jasa = cleanNumber(r[COL.JASA] as string);
    const angsuran = cleanNumber(r[COL.ANGSURAN] as string) || Math.ceil(pinjam/selama);
    const potBulan = cleanNumber(r[C.POT_BULAN] as string);
    const totalBulan = cleanNumber(r[C.TOTAL_BULAN] as string);
    const jumlahSd = cleanNumber(r[C.JUMLAH_SD] as string);
    const sisaSaldo = cleanNumber(r[C.SISA_SALDO] as string);
    const tglPinjam = parseExcelDate(r[COL.TGL_PINJAM] as string);

    // Member match
    let member = nrp ? allMembers.find(m => m.nrp === nrp || m.memberNo === nrp) : undefined;
    if (!member) {
      const cn = cleanNameForMatch(rawNama);
      member = allMembers.find(m => cleanNameForMatch(m.name) === cn);
      if (!member) member = allMembers.find(m => { const mc = cleanNameForMatch(m.name); return mc.length>3 && cn.length>3 && (mc.includes(cn)||cn.includes(mc)); });
    }

    // Loan match
    const memberLoans = member ? allLoans.filter(l => l.memberId === member!.id) : [];
    let existingLoan = memberLoans.length === 1 ? memberLoans[0]
      : tglPinjam ? memberLoans.find(l => Math.abs(Number(l.principalAmount)-pinjam)/pinjam<0.01 && l.disbursementDate && Math.abs(l.disbursementDate.getTime()-tglPinjam.getTime())<30*864e5) : undefined;
    if (!existingLoan && memberLoans.length > 1) existingLoan = memberLoans.find(l => Math.abs(Number(l.principalAmount)-pinjam)/pinjam<0.01);

    const status: Row["status"] = !member ? "NEW_MEMBER" : !existingLoan ? "NEW_LOAN" : "UPDATE";
    results.push({
      nrp: nrp||"-", nama: rawNama, pangkat: String(r[COL.PANGKAT]||"").trim(), pinjam, selama, jasa, angsuran, potBulan, totalBulan, jumlahSd, sisaSaldo, tglPinjam,
      status, memberId: member?.id ?? null, memberName: member?.name ?? `[BARU] ${rawNama}`,
      loanId: existingLoan?.id ?? null, loanNo: existingLoan?.loanNo ?? null,
      reason: !member ? "Anggota baru" : !existingLoan ? "Tak ada loan active match" : `Update loan ${existingLoan.loanNo}`,
    });
  }

  // 5. Summary
  const sum = {
    UPDATE: results.filter(r=>r.status==="UPDATE").length,
    NEW_LOAN: results.filter(r=>r.status==="NEW_LOAN").length,
    NEW_MEMBER: results.filter(r=>r.status==="NEW_MEMBER").length,
    SKIP_ZERO: results.filter(r=>r.status==="SKIP_ZERO").length,
  };
  console.log("\n=== SUMMARY ===");
  console.table(sum);
  const totalSisaUpdate = results.filter(r=>r.status==="UPDATE").reduce((s,r)=>s+r.sisaSaldo,0);
  console.log(`UPDATE: total sisa saldo di-file = Rp ${totalSisaUpdate.toLocaleString("id-ID")}`);

  // 6. Sample
  console.log("\n=== SAMPLE (first 12 UPDATE) ===");
  results.filter(r=>r.status==="UPDATE").slice(0,12).forEach(r =>
    console.log(`  ${r.nrp} | ${r.nama.slice(0,22)} | pokok ${r.pinjam.toLocaleString("id-ID")} | sisa ${r.sisaSaldo.toLocaleString("id-ID")} | → ${r.loanNo}`)
  );
  if (sum.NEW_LOAN) {
    console.log("\n=== NEW_LOAN (first 10 — REVIEW, seharusnya sedikit) ===");
    results.filter(r=>r.status==="NEW_LOAN").slice(0,10).forEach(r =>
      console.log(`  ${r.nrp} | ${r.nama.slice(0,22)} | member=${r.memberName} | pokok ${r.pinjam.toLocaleString("id-ID")}`)
    );
  }
  if (sum.NEW_MEMBER) {
    console.log("\n=== NEW_MEMBER (first 10 — anggota belum terdaftar) ===");
    results.filter(r=>r.status==="NEW_MEMBER").slice(0,10).forEach(r =>
      console.log(`  ${r.nrp||"(no NRP)"} | ${r.nama.slice(0,22)} | pokok ${r.pinjam.toLocaleString("id-ID")}`)
    );
  }

  // 7. Idempotency preview: how many UPDATE rows already have a Juli payment
  const updateLoanIds = results.filter(r=>r.status==="UPDATE" && r.loanId).map(r=>r.loanId!);
  const existingPayments = await prisma.loanPayment.count({
    where: { loanId: { in: updateLoanIds }, paymentDate: { gte: new Date(period.year, period.monthNum-1, 1), lt: new Date(period.year, period.monthNum, 1) } },
  });
  console.log(`\nUPDATE rows already punya pembayaran ${MONTH_INDONESIAN[period.monthNum-1]} ${period.year}: ${existingPayments} (idempoten — tak dobel)`);

  // 8. Commit gate
  if (!COMMIT) {
    console.log("\n=== PREVIEW ONLY — no DB changes. Re-run dengan --commit untuk eksekusi. ===");
    writeFileSync("qa/sp-juli-preview.json", JSON.stringify({ period: `${MONTH_INDONESIAN[period.monthNum-1]} ${period.year}`, summary: sum, rows: results }, null, 2));
    console.log("Preview disimpan: qa/sp-juli-preview.json");
    return;
  }

  // ── COMMIT ──
  console.log("\n=== COMMITTING ===");
  const adminUser = await prisma.user.findFirst({ where: { role: { name: "operator" } }, select: { id: true, name: true } });
  const adminId = adminUser?.id ?? 1;
  if (!adminUser) { console.error("No operator user found — aborting commit."); process.exit(1); }
  console.log(`Acting as: ${adminUser.name} (id ${adminId})`);
  const periodMonth0 = period.monthNum - 1;
  let seq = (await prisma.loanApplication.findFirst({ where: { applicationNo: { startsWith: "SP-IMP/" } }, orderBy: { applicationNo: "desc" } }))?.applicationNo.match(/SP-IMP\/(\d+)\//)?.[1];
  let loanSeq = seq ? parseInt(seq,10) : 0;
  let paySeq = (await prisma.loanPayment.findFirst({ where: { paymentNo: { startsWith: "PAY-IMP/" } }, orderBy: { paymentNo: "desc" } }))?.paymentNo.match(/PAY-IMP\/(\d+)\//)?.[1];
  let pSeq = paySeq ? parseInt(paySeq,10) : 0;
  const romawi = ROMAWI[new Date().getMonth()]; const yr = new Date().getFullYear();
  const nextLoanNo = () => `SP-IMP/${String(++loanSeq).padStart(4,"0")}/PRIM/${romawi}/${yr}`;
  const nextPayNo = () => `PAY-IMP/${String(++pSeq).padStart(4,"0")}/PRIM/${romawi}/${yr}`;

  let ok = 0, fail = 0;
  const tasks = results.filter(r => ["UPDATE","NEW_LOAN","NEW_MEMBER"].includes(r.status));

  // ANOMALY GUARD: skip UPDATE rows where sisa would INCREASE (refinance / data error).
  // A loan being paid down must have sisa ↓. Increase = human-decision event, not auto-import.
  const currentSisa: Record<number, number> = {};
  const updIds = tasks.filter(t => t.status === "UPDATE" && t.loanId).map(t => t.loanId!);
  for (const l of await prisma.loan.findMany({ where: { id: { in: updIds } }, select: { id: true, principalOutstanding: true } })) {
    currentSisa[l.id] = Number(l.principalOutstanding);
  }
  const skipped: string[] = [];
  const SKIP_TOLERANCE = 100000; // Rp 100rb tolerance for rounding noise
  for (let bi = 0; bi < tasks.length; bi += 5) {
    await Promise.all(tasks.slice(bi, bi+5).map(async (r) => {
      // Anomaly guard — skip if UPDATE would increase sisa
      if (r.status === "UPDATE" && r.loanId && currentSisa[r.loanId] !== undefined &&
          r.sisaSaldo > currentSisa[r.loanId] + SKIP_TOLERANCE) {
        skipped.push(`${r.nrp} ${r.nama.slice(0,18)}: ${currentSisa[r.loanId].toLocaleString("id-ID")} → ${r.sisaSaldo.toLocaleString("id-ID")}`);
        return;
      }
      try {
        await prisma.$transaction(async (tx) => {
          let memberId = r.memberId;
          // auto-register new member
          if (!memberId) {
            const effNrp = r.nrp !== "-" ? r.nrp : `MBR-${r.nama.replace(/\s+/g,"").substring(0,8).toUpperCase()}`;
            const m = await tx.member.create({ data: { memberNo: effNrp, nrp: effNrp, name: r.nama, pangkat: r.pangkat||null, branchId: defaultBranch!.id, joinDate: new Date(), status: "active" } });
            memberId = m.id;
            const role = await tx.role.findUnique({ where: { name: "anggota" } });
            if (role) await tx.user.create({ data: { name: r.nama, email: `${effNrp}@koperasi.local`, password: await hash(effNrp), roleId: role.id, branchId: defaultBranch!.id, memberId: m.id, isActive: true } });
          }
          let loanId = r.loanId ?? undefined;
          const appDate = r.tglPinjam || new Date();
          if (!loanId) {
            // create new loan (truly new) — create application first, then loan with its id
            const appNo = nextLoanNo();
            const ti = r.jasa * r.selama;
            const app = await tx.loanApplication.create({ data: { applicationNo: appNo, memberId, branchId: defaultBranch!.id, productId: defaultProduct!.id, amount: r.pinjam, tenorMonths: r.selama, purpose: `Import VS SP ${MONTH_INDONESIAN[periodMonth0]} ${period.year}`, status: "disbursed", deductionSource: "gaji", createdById: adminId, createdAt: appDate, approvedAt: appDate, approvedById: adminId } });
            const ln = await tx.loan.create({ data: { loanNo: appNo, applicationId: app.id, memberId, branchId: defaultBranch!.id, productSnapshot: JSON.parse(JSON.stringify(defaultProduct)), principalAmount: r.pinjam, interestAmount: ti, totalAmount: r.pinjam+ti, adminFee: Math.round(r.pinjam*0.02), disbursedAmount: r.pinjam-Math.round(r.pinjam*0.02), tenorMonths: r.selama, interestRate: r.pinjam>0?Number(((r.jasa/r.pinjam)*100).toFixed(2)):0, interestMethod: defaultProduct!.interestMethod||"flat", monthlyInstallment: Math.floor(r.pinjam/r.selama)+r.jasa, principalPaid: r.jumlahSd, interestPaid: r.totalBulan*r.jasa, lateFeePaid: 0, principalOutstanding: r.sisaSaldo, interestOutstanding: Math.max(0,ti-r.totalBulan*r.jasa), disbursementDate: appDate, firstDueDate: new Date(appDate.getFullYear(),appDate.getMonth()+1,1), lastDueDate: new Date(appDate.getFullYear(),appDate.getMonth()+r.selama,1), status: (r.sisaSaldo<=0&&(r.jumlahSd>0||r.totalBulan>=r.selama))?"paid_off":"active", paidOffDate: null, disbursedById: adminId } });
            loanId = ln.id;
          } else {
            // UPDATE existing loan balances
            const ti = r.jasa * r.selama;
            await tx.loan.update({ where: { id: loanId }, data: { principalPaid: r.jumlahSd, principalOutstanding: r.sisaSaldo, interestPaid: r.totalBulan*r.jasa, interestOutstanding: Math.max(0, ti-r.totalBulan*r.jasa), status: (r.sisaSaldo<=0&&(r.jumlahSd>0||r.totalBulan>=r.selama))?"paid_off":"active" } });
          }
          // idempotent monthly payment
          if (r.potBulan > 0 && loanId) {
            const exist = await tx.loanPayment.findFirst({ where: { loanId, paymentDate: { gte: new Date(period.year, periodMonth0, 1), lt: new Date(period.year, periodMonth0+1, 1) } } });
            if (!exist) await tx.loanPayment.create({ data: { paymentNo: nextPayNo(), loanId, memberId, branchId: defaultBranch!.id, amount: r.potBulan, principalPortion: r.angsuran, interestPortion: r.jasa, lateFeePortion: 0, paymentType: "installment", notes: `Import VS SP ${MONTH_INDONESIAN[periodMonth0]} ${period.year}`, paymentDate: new Date(period.year, periodMonth0, 28), createdById: adminId } });
          }
        }, { timeout: 30000 });
        ok++;
      } catch (e) { fail++; console.error(`FAIL ${r.nrp} ${r.nama}:`, (e as Error).message); }
    }));
  }
  console.log(`\nCOMMIT done: ${ok} OK | ${fail} FAIL | ${skipped.length} SKIPPED (sisa naik — review manual)`);
  if (skipped.length) { console.log("Skipped rows:"); skipped.forEach(s => console.log("  " + s)); }
}

import bcrypt from "bcryptjs";
const hash = (s: string) => bcrypt.hash(s, 10);

main().catch(e => { console.error("FATAL:", e); process.exit(1); }).finally(() => prisma.$disconnect());
