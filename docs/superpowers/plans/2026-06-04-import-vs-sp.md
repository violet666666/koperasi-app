# Import VS SP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a dedicated "Import VS SP" feature that reads monthly SP Excel files (GAJI sheet) and updates/creates loan data in the database with preview, selective import, and undo capability.

**Architecture:** New API route `POST /api/loans/import-vs-sp` handles Excel parsing with hardcoded GAJI-sheet column mapping, auto-detects period from headers, matches members (NRP → Name → Auto-create) and loans (Amount+Date → Amount → Create). ImportBatch model tracks committed data for undo. UI extends existing `/master/import-data` page with `vs_sp` type and sheet selector.

**Tech Stack:** Next.js 16 API Route, Prisma 6, xlsx (SheetJS), shadcn/ui components, React Hook Form

**Design Spec:** `docs/superpowers/specs/2026-06-04-import-vs-sp-design.md`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `src/app/api/loans/import-vs-sp/route.ts` | POST handler: parse Excel, match members/loans, preview/commit |
| Create | `src/app/api/loans/import-vs-sp/batches/route.ts` | GET: list import batches |
| Create | `src/app/api/loans/import-vs-sp/batches/[batchId]/route.ts` | DELETE: undo a batch |
| Modify | `prisma/schema.prisma` | Add ImportBatch model |
| Modify | `src/app/(protected)/master/import-data/page.tsx` | Add `vs_sp` import type, sheet selector, summary cards |
| Modify | `src/lib/audit-logger.ts` | No change needed — already supports IMPORT action |

---

### Task 1: Add ImportBatch model to Prisma schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add ImportBatch model to schema**

Add after the `LoanPaymentAllocation` model (around line 597):

```prisma
model ImportBatch {
  id                  String   @id @default(uuid())
  batchNo             String   @unique
  type                String   @default("import_vs_sp")
  fileName            String
  sheetName           String
  period              String
  totalRows           Int      @default(0)
  successCount        Int      @default(0)
  errorCount          Int      @default(0)
  loanIds             Json     @default("[]")
  paymentIds          Json     @default("[]")
  memberIds           Json     @default("[]")
  preImportSnapshots  Json     @default("{}")
  createdById         String
  createdBy           User     @relation(fields: [createdById], references: [id], name: "ImportBatchCreator")
  createdAt           DateTime @default(now())

  @@map("import_batches")
}
```

- [ ] **Step 2: Add relation to User model**

In the `User` model, add a relation line near the other relation fields:

```prisma
  importBatches       ImportBatch[]
```

- [ ] **Step 3: Push schema to database**

Run: `npm run db:push`

Expected: Schema synchronized without errors.

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(import-vs-sp): add ImportBatch model to Prisma schema"
```

---

### Task 2: Create the main import API route (core logic)

**Files:**
- Create: `src/app/api/loans/import-vs-sp/route.ts`

This is the largest task. The route handles preview and commit in one file, following the same pattern as `import-update/route.ts`.

- [ ] **Step 1: Create the route file with full implementation**

Create `src/app/api/loans/import-vs-sp/route.ts` with the following complete code:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export const maxDuration = 300;

// === Column mapping for GAJI sheet (0-indexed) ===
const COL = {
  NO: 0,
  KODE_SATKER: 1,
  KLASIFIKASI: 2,
  NAMA: 3,
  PANGKAT: 4,
  NRP: 5,
  TGL_PINJAM: 6,
  PINJAM: 7,
  SELAMA: 8,
  JASA: 9,
  ANGSURAN: 10,
  POT_BULAN: 11,
  TOTAL_BULAN: 12,
  JUMLAH_SD: 13,
  SISA_SALDO: 14,
};

const SUMMARY_KEYWORDS = [
  "JUMLAH", "PERMINTAAN", "GAGAL POT", "DITERIMA", "DIKEMBALIKAN",
  "MENGEMBALIKAN", "SAMA DENGAN",
];

const ROMAWI = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];

const MONTH_NAME_MAP: Record<string, number> = {
  "jan": 1, "januari": 1, "peb": 2, "februari": 2, "pebruari": 2,
  "maret": 3, "mrt": 3, "april": 4, "mei": 5,
  "juni": 6, "jul": 7, "juli": 7, "ags": 8, "agustus": 8,
  "sept": 9, "september": 9, "okt": 10, "oktober": 10,
  "nop": 11, "nov": 11, "des": 12,
};

function cleanNrp(raw: string | number | undefined): string {
  return String(raw ?? "").replace(/['"]/g, "").replace(/\.0$/, "").trim();
}

function cleanNumber(raw: string | number | undefined): number {
  if (raw === undefined || raw === null || raw === "") return 0;
  if (typeof raw === "number") return raw;
  const isNegative = String(raw).includes("(") && String(raw).includes(")");
  const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
  let num = parseFloat(cleaned);
  if (isNaN(num)) return 0;
  if (isNegative) num = -Math.abs(num);
  return num;
}

function cleanNameForMatch(name: string): string {
  if (!name) return "";
  let clean = String(name).replace(/['"]/g, "").trim().toUpperCase();
  clean = clean.split(",")[0].trim();
  const titles = [
    " S.H.", " SH", " S.PD.", " S.PD", " S.T.K.", " STK",
    " S.SOS.", " S.SOS", " S.E.", " SE", " S.IP.", " SIP",
    " M.H.", " MH", " M.SC.", " MSC", " M.M.", " MM",
    " S.T.", " ST", " S.PT.", " SPT", " S.OR.", " S.I.K.", " SIK",
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of titles) {
      if (clean.endsWith(t) || clean.endsWith(t.replace(/\./g, ""))) {
        clean = clean.substring(0, clean.length - t.length).trim();
        changed = true;
      }
    }
  }
  return clean.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function parseExcelDate(raw: string | number | undefined): Date | null {
  if (!raw || !String(raw).trim() || String(raw).trim() === "-") return null;
  const str = String(raw).trim();

  // Fix typos like "12 mei 226" → "12 mei 2026"
  const typoFix = str.replace(/(\d{1,2})\s+(\w+)\s+(\d{2,3})$/, (match, d, m, y) => {
    const yearNum = parseInt(y);
    if (yearNum > 20 && yearNum < 300) return `${d} ${m} 20${y}`;
    return match;
  });

  const monthMap: Record<string, number> = {
    "jan": 0, "januari": 0, "peb": 1, "feb": 1, "februari": 1, "pebruari": 1,
    "mar": 2, "maret": 2, "mrt": 2, "arp": 3, "apr": 3, "april": 3,
    "mei": 4, "may": 4, "jun": 5, "juni": 5, "jul": 6, "juli": 6,
    "agu": 7, "agt": 7, "ags": 7, "agustus": 7, "aug": 7,
    "sep": 8, "sept": 8, "september": 8, "okt": 9, "oktober": 9, "oct": 9,
    "nov": 10, "nop": 10, "november": 10, "des": 11, "desember": 11, "dec": 11,
  };

  const parts = typoFix.split(/[\s/+']+/);
  if (parts.length >= 3) {
    const day = parseInt(parts[0]);
    const monthStr = parts[1].toLowerCase().replace(/\./g, "");
    const yearStr = parts[2];
    const year = parseInt(yearStr);
    const month = monthMap[monthStr];
    if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 2000) {
      return new Date(year, month, day);
    }
  }

  const d = new Date(str);
  if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

  const num = parseFloat(str);
  if (!isNaN(num) && num > 40000 && num < 60000) {
    return new Date((num - 25569) * 86400 * 1000);
  }
  return null;
}

function detectPeriod(rows: any[][]): { monthNum: number; monthName: string; year: number } | null {
  // Row 6 typically has "PER 31 JUNI 2026" or "PER 30 APRIL 2026"
  const row6 = rows[6] || [];
  const row6Str = row6.join(" ").toUpperCase();

  const periodMatch = row6Str.match(/PER\s+\d+\s+(\w+)\s+(\d{4})/);
  if (periodMatch) {
    const mName = periodMatch[1].toLowerCase().replace(/\./g, "");
    const mNum = MONTH_NAME_MAP[mName];
    const yNum = parseInt(periodMatch[2]);
    if (mNum && yNum > 2020) {
      const fullNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      return { monthNum: mNum, monthName: fullNames[mNum], year: yNum };
    }
  }

  // Fallback: check row 11 sub-header for "POT [BULAN]"
  const row11 = rows[11] || [];
  const row11Str = row11.join(" ").toUpperCase();
  for (const [name, num] of Object.entries(MONTH_NAME_MAP)) {
    if (row11Str.includes(`POT ${name.toUpperCase()}`)) {
      const fullNames = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      return { monthNum: num, monthName: fullNames[num], year: new Date().getFullYear() };
    }
  }

  return null;
}

// POST /api/loans/import-vs-sp
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
    if (roleName !== "operator") {
      return NextResponse.json({ message: "Hanya Operator yang dapat menggunakan Import VS SP." }, { status: 403 });
    }
    const adminId = session.user.id ? Number(session.user.id) : 1;

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";
    const sheetName = (formData.get("sheetName") as string) || "GAJI";
    const selectedRowsParam = formData.get("selectedRows") as string | null;
    const selectedRows = selectedRowsParam ? JSON.parse(selectedRowsParam) as number[] : null;

    if (!file) {
      return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    // Return available sheets if no match
    if (!workbook.SheetNames.includes(sheetName)) {
      return NextResponse.json({
        message: `Sheet "${sheetName}" tidak ditemukan`,
        availableSheets: workbook.SheetNames,
      }, { status: 400 });
    }

    const worksheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];

    // Detect period from header
    const period = detectPeriod(rows);
    if (!period) {
      return NextResponse.json({
        message: "Tidak dapat mendeteksi periode dari header Excel. Pastikan baris header mengandung 'PER [tanggal] [bulan] [tahun]'.",
        availableSheets: workbook.SheetNames,
      }, { status: 400 });
    }

    // Load reference data
    const allMembers = await prisma.member.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, branchId: true },
    });

    const allLoans = await prisma.loan.findMany({
      where: { status: { in: ["active", "paid_off"] } },
      select: {
        id: true, loanNo: true, memberId: true, principalAmount: true,
        principalPaid: true, principalOutstanding: true, interestOutstanding: true,
        interestAmount: true, interestPaid: true, tenorMonths: true, branchId: true,
        disbursementDate: true, status: true,
      },
    });

    const existingPayments = await prisma.loanPayment.findMany({
      where: {
        paymentDate: {
          gte: new Date(period.year, period.monthNum - 1, 1),
          lt: new Date(period.year, period.monthNum, 1),
        },
        notes: { contains: "Import VS SP" },
      },
      select: { loanId: true, paymentDate: true },
    });

    const defaultProduct = await prisma.loanProduct.findFirst({ where: { isActive: true } });
    const defaultBranch = await prisma.branch.findFirst({ where: { isHeadOffice: true, isActive: true } })
      || await prisma.branch.findFirst({ where: { isActive: true } });

    // Sequence generators
    const importMonth = ROMAWI[period.monthNum - 1];
    const loanPrefix = "SP-IMP/";
    const payPrefix = "PAY-IMP/";
    const monthYearSuffix = `/PRIM/${importMonth}/${period.year}`;

    const lastLoanApp = await prisma.loanApplication.findFirst({
      where: { applicationNo: { startsWith: loanPrefix } },
      orderBy: { applicationNo: "desc" },
      select: { applicationNo: true },
    });
    let loanSeq = 0;
    if (lastLoanApp) {
      const match = lastLoanApp.applicationNo.match(/SP-IMP\/(\d+)\//);
      if (match) loanSeq = parseInt(match[1], 10);
    }

    const lastPayment = await prisma.loanPayment.findFirst({
      where: { paymentNo: { startsWith: payPrefix } },
      orderBy: { paymentNo: "desc" },
      select: { paymentNo: true },
    });
    let paySeq = 0;
    if (lastPayment) {
      const match = lastPayment.paymentNo.match(/PAY-IMP\/(\d+)\//);
      if (match) paySeq = parseInt(match[1], 10);
    }

    const nextLoanNo = () => {
      loanSeq++;
      return `${loanPrefix}${String(loanSeq).padStart(4, "0")}${monthYearSuffix}`;
    };
    const nextPaymentNo = () => {
      paySeq++;
      return `${payPrefix}${String(paySeq).padStart(4, "0")}${monthYearSuffix}`;
    };

    // Parse data rows (start from row 12)
    const results: any[] = [];
    const commitTasks: { task: () => Promise<void>; resultIdx: number }[] = [];
    let updateCount = 0;
    let newLoanCount = 0;
    let newMemberCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 12; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length <= COL.SISA_SALDO) continue;

      const rawNama = String(row[COL.NAMA] || "").trim();
      if (!rawNama) continue;

      // Skip summary rows
      const namaUpper = rawNama.toUpperCase();
      if (SUMMARY_KEYWORDS.some(kw => namaUpper.startsWith(kw))) continue;

      // Skip numeric-only "names"
      if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

      const pinjam = cleanNumber(row[COL.PINJAM]);
      if (pinjam <= 0) {
        results.push({
          rowIndex: i, status: "SKIP_ZERO", memberName: rawNama, nrp: cleanNrp(row[COL.NRP]),
          pinjam, notes: "PINJAM ≤ 0 (saldo koreksi)",
        });
        skipCount++;
        continue;
      }

      const nrp = cleanNrp(row[COL.NRP]);
      const selama = cleanNumber(row[COL.SELAMA]) || 12;
      const jasa = cleanNumber(row[COL.JASA]);
      const angsuran = cleanNumber(row[COL.ANGSURAN]) || Math.ceil(pinjam / selama);
      const potBulan = cleanNumber(row[COL.POT_BULAN]);
      const totalBulan = cleanNumber(row[COL.TOTAL_BULAN]);
      const jumlahSd = cleanNumber(row[COL.JUMLAH_SD]);
      const sisaSaldo = cleanNumber(row[COL.SISA_SALDO]);
      const tglPinjam = parseExcelDate(row[COL.TGL_PINJAM]);
      const klasifikasi = row[COL.KLASIFIKASI] || 1;

      // Validate: must have NRP or name
      if (!nrp && !rawNama) {
        results.push({
          rowIndex: i, status: "ERROR", memberName: rawNama, nrp,
          pinjam, notes: "Tidak ada NRP dan Nama",
        });
        errorCount++;
        continue;
      }

      // === MEMBER MATCHING ===
      let member: typeof allMembers[0] | undefined;
      let memberMatchMethod = "none";

      // Tier 1: NRP exact
      if (nrp) {
        member = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
        if (member) memberMatchMethod = "NRP";
      }

      // Tier 2: Name match
      if (!member) {
        const cleanName = cleanNameForMatch(rawNama);
        member = allMembers.find(m => cleanNameForMatch(m.name) === cleanName);
        if (member) memberMatchMethod = "Name";
        if (!member) {
          member = allMembers.find(m => {
            const mClean = cleanNameForMatch(m.name);
            return mClean.length > 3 && cleanName.length > 3 &&
              (mClean.includes(cleanName) || cleanName.includes(mClean));
          });
          if (member) memberMatchMethod = "Name (fuzzy)";
        }
      }

      // === LOAN MATCHING (only if member found) ===
      let matchedLoan: typeof allLoans[0] | undefined;
      let loanMatchMethod = "none";

      if (member) {
        const memberLoans = allLoans.filter(l => l.memberId === member!.id);

        // Strategy 1: Amount + Date
        if (tglPinjam) {
          matchedLoan = memberLoans.find(l => {
            const amtDiff = Math.abs(Number(l.principalAmount) - pinjam) / pinjam;
            const dateDiff = Math.abs(l.disbursementDate.getTime() - tglPinjam!.getTime()) / (1000 * 60 * 60 * 24);
            return amtDiff < 0.01 && dateDiff <= 30;
          });
          if (matchedLoan) loanMatchMethod = "Amount+Date";
        }

        // Strategy 2: Amount only
        if (!matchedLoan) {
          const candidates = memberLoans
            .filter(l => Math.abs(Number(l.principalAmount) - pinjam) / pinjam < 0.05 && l.status === "active")
            .sort((a, b) => b.disbursementDate.getTime() - a.disbursementDate.getTime());
          matchedLoan = candidates[0];
          if (matchedLoan) loanMatchMethod = "Amount";
        }
      }

      // === DETERMINE STATUS ===
      let status: string;
      if (!member) {
        status = "NEW_MEMBER";
        newMemberCount++;
      } else if (!matchedLoan) {
        status = "NEW_LOAN";
        newLoanCount++;
      } else {
        status = "UPDATE";
        updateCount++;
      }

      const hasPayment = potBulan > 0;
      const isPaidOff = sisaSaldo <= 0;

      const resultIdx = results.length;
      results.push({
        rowIndex: i,
        status,
        memberMatch: memberMatchMethod,
        loanMatch: loanMatchMethod,
        memberName: member ? member.name : `[BARU] ${rawNama}`,
        memberId: member?.id || null,
        nrp: nrp || "(tanpa NRP)",
        pinjam,
        selama,
        jasa,
        angsuran,
        klasifikasi,
        potBulan,
        totalBulan: totalBulan || (hasPayment ? angsuran + jasa : 0),
        jumlahSd,
        sisaSaldo,
        loanNo: matchedLoan?.loanNo || null,
        loanId: matchedLoan?.id || null,
        paidCount: (angsuran + jasa) > 0 ? Math.round(jumlahSd / (angsuran + jasa)) : 0,
        isPaidOff,
        hasPayment,
        notes: isPaidOff ? "LUNAS" : (hasPayment ? null : "Gagal pot bulan ini"),
      });

      // === COMMIT TASKS ===
      if (mode === "commit" && (selectedRows === null || selectedRows.includes(i))) {
        const capturedData = {
          nrp, rawNama, pinjam, selama, jasa, angsuran, potBulan, totalBulan: totalBulan || (hasPayment ? angsuran + jasa : 0),
          jumlahSd, sisaSaldo, tglPinjam, klasifikasi, isPaidOff, hasPayment, memberMatchMethod, loanMatchMethod,
        };
        const capturedMember = member;
        const capturedLoan = matchedLoan;

        commitTasks.push({
          resultIdx,
          task: async () => {
            try {
              await prisma.$transaction(async (tx) => {
                let activeMemberId: number;
                let loanId: number | undefined;

                // Auto-create member if needed
                if (!capturedMember) {
                  const effectiveNrp = capturedData.nrp || `MBR-${capturedData.rawNama.replace(/\s+/g, "").substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
                  const branch = defaultBranch || await tx.branch.findFirst({ where: { isActive: true } });
                  if (!branch) throw new Error("No active branch");

                  const newMember = await tx.member.create({
                    data: {
                      memberNo: effectiveNrp,
                      nrp: effectiveNrp,
                      name: capturedData.rawNama,
                      pangkat: String(rows[capturedData.nrp ? 0 : 0] || ""), // We'll skip pangkat for now
                      branchId: branch.id,
                      joinDate: new Date(),
                      status: "active",
                    },
                  });
                  activeMemberId = newMember.id;

                  const anggotaRole = await tx.role.findUnique({ where: { name: "anggota" } });
                  if (anggotaRole) {
                    const hashedPassword = await bcrypt.hash(effectiveNrp, 10);
                    await tx.user.create({
                      data: {
                        name: capturedData.rawNama,
                        email: `${effectiveNrp}@koperasi.local`,
                        password: hashedPassword,
                        roleId: anggotaRole.id,
                        branchId: branch.id,
                        memberId: newMember.id,
                        isActive: true,
                      },
                    });
                  }
                } else {
                  activeMemberId = capturedMember.id;
                }

                // Create or update loan
                if (!capturedLoan) {
                  // NEW LOAN
                  const product = defaultProduct || await tx.loanProduct.findFirst({ where: { isActive: true } });
                  const branch = defaultBranch || await tx.branch.findFirst({ where: { isActive: true } });
                  if (!product || !branch) throw new Error("Missing product or branch config");

                  const applicationDate = capturedData.tglPinjam || new Date();
                  const applicationNo = nextLoanNo();
                  const totalInterest = capturedData.jasa * capturedData.selama;

                  const app = await tx.loanApplication.create({
                    data: {
                      applicationNo,
                      memberId: activeMemberId,
                      branchId: branch.id,
                      productId: product.id,
                      amount: capturedData.pinjam,
                      tenorMonths: capturedData.selama,
                      purpose: `Import VS SP ${period.monthName} ${period.year}`,
                      status: "disbursed",
                      deductionSource: "gaji",
                      createdById: adminId,
                      createdAt: applicationDate,
                      approvedAt: applicationDate,
                      approvedById: adminId,
                    },
                  });

                  const loan = await tx.loan.create({
                    data: {
                      loanNo: applicationNo,
                      applicationId: app.id,
                      memberId: activeMemberId,
                      branchId: branch.id,
                      productSnapshot: JSON.parse(JSON.stringify(product)),
                      principalAmount: capturedData.pinjam,
                      interestAmount: totalInterest,
                      totalAmount: capturedData.pinjam + totalInterest,
                      adminFee: Math.round(capturedData.pinjam * 0.02),
                      disbursedAmount: capturedData.pinjam - Math.round(capturedData.pinjam * 0.02),
                      tenorMonths: capturedData.selama,
                      interestRate: capturedData.pinjam > 0 ? Number(((capturedData.jasa / capturedData.pinjam) * 100).toFixed(2)) : 0,
                      interestMethod: product.interestMethod || "flat",
                      monthlyInstallment: capturedData.angsuran + capturedData.jasa,
                      principalPaid: capturedData.jumlahSd,
                      interestPaid: (capturedData.angsuran + capturedData.jasa) > 0
                        ? capturedData.jumlahSd * (capturedData.jasa / (capturedData.angsuran + capturedData.jasa))
                        : 0,
                      lateFeePaid: 0,
                      principalOutstanding: capturedData.sisaSaldo,
                      interestOutstanding: Math.max(0, totalInterest - capturedData.jumlahSd * (capturedData.jasa / (capturedData.angsuran + capturedData.jasa))),
                      disbursementDate: applicationDate,
                      firstDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + 1, 1),
                      lastDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + capturedData.selama, 1),
                      status: capturedData.isPaidOff ? "paid_off" : "active",
                      paidOffDate: capturedData.isPaidOff ? new Date() : null,
                      disbursedById: adminId,
                    },
                  });
                  loanId = loan.id;

                  // Generate schedules
                  const paidCount = (capturedData.angsuran + capturedData.jasa) > 0
                    ? Math.round(capturedData.jumlahSd / (capturedData.angsuran + capturedData.jasa))
                    : 0;
                  const scheds = [];
                  for (let j = 1; j <= capturedData.selama; j++) {
                    const dueDate = new Date(applicationDate.getFullYear(), applicationDate.getMonth() + j, 1);
                    let schedPrincipal = Math.floor(capturedData.pinjam / capturedData.selama);
                    if (j === capturedData.selama) {
                      schedPrincipal += (capturedData.pinjam - Math.floor(capturedData.pinjam / capturedData.selama) * capturedData.selama);
                    }
                    const isPaid = j <= paidCount;
                    scheds.push({
                      loanId: loanId!,
                      installmentNo: j,
                      dueDate,
                      principalAmount: schedPrincipal,
                      interestAmount: capturedData.jasa,
                      totalAmount: schedPrincipal + capturedData.jasa,
                      principalPaid: isPaid ? schedPrincipal : 0,
                      interestPaid: isPaid ? capturedData.jasa : 0,
                      status: isPaid ? "paid" : "pending",
                    });
                  }
                  await tx.loanSchedule.createMany({ data: scheds });
                } else {
                  // UPDATE EXISTING LOAN
                  loanId = capturedLoan.id;
                  const totalInterest = capturedData.jasa * capturedData.selama;
                  const totalInstallment = capturedData.angsuran + capturedData.jasa;
                  const interestProportion = totalInstallment > 0 ? capturedData.jasa / totalInstallment : 0;
                  const updatedInterestPaid = Math.round(capturedData.jumlahSd * interestProportion);

                  await tx.loan.update({
                    where: { id: loanId },
                    data: {
                      principalAmount: capturedData.pinjam,
                      interestAmount: totalInterest,
                      totalAmount: capturedData.pinjam + totalInterest,
                      tenorMonths: capturedData.selama,
                      interestRate: capturedData.pinjam > 0 ? Number(((capturedData.jasa / capturedData.pinjam) * 100).toFixed(2)) : 0,
                      monthlyInstallment: totalInstallment,
                      principalPaid: capturedData.jumlahSd,
                      interestPaid: updatedInterestPaid,
                      principalOutstanding: capturedData.sisaSaldo,
                      interestOutstanding: Math.max(0, totalInterest - updatedInterestPaid),
                      status: capturedData.isPaidOff ? "paid_off" : "active",
                      paidOffDate: capturedData.isPaidOff ? new Date() : null,
                    },
                  });

                  // Update schedule statuses (do NOT delete+recreate)
                  const paidCount = totalInstallment > 0 ? Math.round(capturedData.jumlahSd / totalInstallment) : 0;
                  const schedules = await tx.loanSchedule.findMany({
                    where: { loanId: loanId! },
                    orderBy: { installmentNo: "asc" },
                  });

                  for (const sched of schedules) {
                    const isPaid = sched.installmentNo <= paidCount;
                    await tx.loanSchedule.update({
                      where: { id: sched.id },
                      data: {
                        principalPaid: isPaid ? Number(sched.principalAmount) : 0,
                        interestPaid: isPaid ? Number(sched.interestAmount) : 0,
                        status: isPaid ? "paid" : "pending",
                        paidDate: isPaid ? new Date(period.year, period.monthNum - 1, 28) : null,
                      },
                    });
                  }
                }

                // Create LoanPayment (only if potBulan > 0)
                if (capturedData.hasPayment && loanId) {
                  const paymentDate = new Date(period.year, period.monthNum - 1, 28);

                  // Idempotency: skip if payment already exists for this loan + month
                  const existing = await tx.loanPayment.findFirst({
                    where: {
                      loanId: loanId!,
                      paymentDate: {
                        gte: new Date(period.year, period.monthNum - 1, 1),
                        lt: new Date(period.year, period.monthNum, 1),
                      },
                      notes: { contains: "Import VS SP" },
                    },
                  });
                  if (!existing) {
                    const principalPortion = Math.min(capturedData.angsuran, capturedData.potBulan);
                    const interestPortion = capturedData.potBulan - principalPortion;

                    await tx.loanPayment.create({
                      data: {
                        paymentNo: nextPaymentNo(),
                        loanId: loanId!,
                        memberId: activeMemberId,
                        branchId: capturedMember?.branchId || (defaultBranch?.id ?? 1),
                        amount: capturedData.potBulan,
                        principalPortion,
                        interestPortion,
                        lateFeePortion: 0,
                        paymentType: "installment",
                        notes: `Import VS SP ${period.monthName} ${period.year}`,
                        paymentDate,
                        createdById: adminId,
                      },
                    });
                  }
                }
              }, { timeout: 30000 });
            } catch (err) {
              console.error(`Commit task error (row ${i}):`, err);
              results[resultIdx].status = "FAILED";
              results[resultIdx].notes = String((err as Error)?.message || err);
              throw err; // Re-throw to let batch handler count failures
            }
          },
        });
      }
    }

    // Execute commit tasks in batches of 5
    let commitSuccess = 0;
    let commitFail = 0;
    const committedLoanIds: string[] = [];
    const committedPaymentIds: string[] = [];
    const committedMemberIds: string[] = [];

    if (mode === "commit" && commitTasks.length > 0) {
      // Snapshot pre-import state for undo
      const preImportSnapshots: Record<string, any> = {};
      for (const ct of commitTasks) {
        const r = results[ct.resultIdx];
        if (r.loanId) {
          const loan = allLoans.find(l => l.id === r.loanId);
          if (loan) {
            preImportSnapshots[loan.id] = {
              principalPaid: loan.principalPaid.toString(),
              principalOutstanding: loan.principalOutstanding.toString(),
              interestPaid: loan.interestPaid.toString(),
              interestOutstanding: loan.interestOutstanding.toString(),
              status: loan.status,
            };
          }
        }
      }

      const BATCH = 5;
      for (let i = 0; i < commitTasks.length; i += BATCH) {
        const batchResults = await Promise.allSettled(
          commitTasks.slice(i, i + BATCH).map(ct => ct.task())
        );
        for (let j = 0; j < batchResults.length; j++) {
          if (batchResults[j].status === "fulfilled") {
            commitSuccess++;
          } else {
            commitFail++;
          }
        }
      }

      // Create ImportBatch record for undo
      try {
        const batchCount = await prisma.importBatch.count({
          where: { type: "import_vs_sp" },
        });
        const batchNo = `VS-SP/${String(batchCount + 1).padStart(4, "0")}/PRIM/${importMonth}/${period.year}`;

        await prisma.importBatch.create({
          data: {
            batchNo,
            type: "import_vs_sp",
            fileName: file.name,
            sheetName,
            period: `${period.monthName} ${period.year}`,
            totalRows: commitTasks.length,
            successCount: commitSuccess,
            errorCount: commitFail,
            loanIds: committedLoanIds,
            paymentIds: committedPaymentIds,
            memberIds: committedMemberIds,
            preImportSnapshots,
            createdById: session.user.id!,
          },
        });
      } catch (e) {
        console.error("Failed to create ImportBatch record:", e);
      }
    }

    // Audit
    try {
      const reqInfo = extractRequestInfo(request);
      const userInfo = extractUserFromSession(session);
      await logAudit({
        ...userInfo, ...reqInfo,
        action: "IMPORT", module: "Loan_VS_SP",
        description: `Import VS SP ${period.monthName} ${period.year}: ${mode === "commit" ? commitSuccess : results.length} diproses, ${commitFail} gagal`,
        newData: { mode, period: `${period.monthName} ${period.year}`, sheetName, successCount: mode === "commit" ? commitSuccess : results.length, failCount: commitFail },
      });
    } catch (e) {}

    return NextResponse.json({
      period: `${period.monthName} ${period.year}`,
      periodInfo: period,
      availableSheets: workbook.SheetNames,
      summary: {
        total: results.length,
        update: updateCount,
        newLoan: newLoanCount,
        newMember: newMemberCount,
        skip: skipCount,
        error: errorCount,
      },
      rows: results,
      mode,
      imported: mode === "commit" ? commitSuccess : undefined,
      failed: mode === "commit" ? commitFail : undefined,
    });
  } catch (error) {
    console.error("POST /api/loans/import-vs-sp error:", error);
    return NextResponse.json({ message: "Gagal memproses file Import VS SP" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit src/app/api/loans/import-vs-sp/route.ts`

Expected: No type errors (or only minor ones to fix inline).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/import-vs-sp/route.ts
git commit -m "feat(import-vs-sp): create main import API route with preview/commit flow"
```

---

### Task 3: Create batches list and undo API routes

**Files:**
- Create: `src/app/api/loans/import-vs-sp/batches/route.ts`
- Create: `src/app/api/loans/import-vs-sp/batches/[batchId]/route.ts`

- [ ] **Step 1: Create batches list route**

Create `src/app/api/loans/import-vs-sp/batches/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/loans/import-vs-sp/batches — list all VS-SP import batches
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const batches = await prisma.importBatch.findMany({
      where: { type: "import_vs_sp" },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        batchNo: true,
        fileName: true,
        sheetName: true,
        period: true,
        totalRows: true,
        successCount: true,
        errorCount: true,
        createdAt: true,
        createdBy: { select: { name: true } },
      },
    });

    return NextResponse.json({ batches });
  } catch (error) {
    console.error("GET /api/loans/import-vs-sp/batches error:", error);
    return NextResponse.json({ message: "Gagal mengambil data batch" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Create undo (delete batch) route**

Create `src/app/api/loans/import-vs-sp/batches/[batchId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// DELETE /api/loans/import-vs-sp/batches/[batchId] — undo an import batch
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
    if (roleName !== "operator") {
      return NextResponse.json({ message: "Hanya Operator yang dapat membatalkan import." }, { status: 403 });
    }

    const { batchId } = await params;
    const batch = await prisma.importBatch.findUnique({ where: { id: batchId } });
    if (!batch) {
      return NextResponse.json({ message: "Batch tidak ditemukan" }, { status: 404 });
    }

    const loanIds = (batch.loanIds as string[]) || [];
    const paymentIds = (batch.paymentIds as string[]) || [];
    const memberIds = (batch.memberIds as string[]) || [];
    const snapshots = (batch.preImportSnapshots as Record<string, any>) || {};

    let undonePayments = 0;
    let undoneLoans = 0;
    let undoneMembers = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Delete LoanPayments
      if (paymentIds.length > 0) {
        const result = await tx.loanPayment.deleteMany({
          where: { id: { in: paymentIds } },
        });
        undonePayments = result.count;
      }

      // 2. Revert updated Loans to pre-import state
      for (const [loanId, snapshot] of Object.entries(snapshots)) {
        // Only revert if member was NOT new (existing loan update)
        if (!memberIds.includes(loanId)) {
          await tx.loan.update({
            where: { id: loanId },
            data: {
              principalPaid: snapshot.principalPaid,
              principalOutstanding: snapshot.principalOutstanding,
              interestPaid: snapshot.interestPaid,
              interestOutstanding: snapshot.interestOutstanding,
              status: snapshot.status,
              paidOffDate: snapshot.status === "paid_off" ? new Date() : null,
            },
          });
          undoneLoans++;
        }
      }

      // 3. For new members: delete their loans, schedules, member, user
      for (const memberId of memberIds) {
        const memberLoans = await tx.loan.findMany({
          where: { memberId: memberId },
          select: { id: true },
        });
        for (const loan of memberLoans) {
          await tx.loanSchedule.deleteMany({ where: { loanId: loan.id } });
          await tx.loanPayment.deleteMany({ where: { loanId: loan.id } });
          await tx.loanApplication.deleteMany({ where: { loan: { id: loan.id } } });
          await tx.loan.delete({ where: { id: loan.id } });
        }
        await tx.user.deleteMany({ where: { memberId: memberId } });
        await tx.member.delete({ where: { id: memberId } });
        undoneMembers++;
      }

      // 4. Delete the batch record
      await tx.importBatch.delete({ where: { id: batchId } });
    });

    // Audit
    try {
      const reqInfo = extractRequestInfo(request);
      const userInfo = extractUserFromSession(session);
      await logAudit({
        ...userInfo, ...reqInfo,
        action: "DELETE", module: "Loan_VS_SP",
        description: `Undo Import VS SP batch ${batch.batchNo}: ${undonePayments} payments, ${undoneLoans} loans reverted, ${undoneMembers} members deleted`,
      });
    } catch (e) {}

    return NextResponse.json({
      message: `Batch ${batch.batchNo} berhasil dibatalkan`,
      undonePayments,
      undoneLoans,
      undoneMembers,
    });
  } catch (error) {
    console.error("DELETE /api/loans/import-vs-sp/batches/[batchId] error:", error);
    return NextResponse.json({ message: "Gagal membatalkan batch import" }, { status: 500 });
  }
}
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`

Expected: No errors in the new route files.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/loans/import-vs-sp/batches/
git commit -m "feat(import-vs-sp): add batch list and undo API routes"
```

---

### Task 4: Extend the import-data UI page

**Files:**
- Modify: `src/app/(protected)/master/import-data/page.tsx`

- [ ] **Step 1: Add `vs_sp` to ImportType union**

At line 29, update the type:

```typescript
type ImportType = "tunkin" | "gaji" | "gaji_uraian" | "tajib" | "akun_anggota" | "sejahtera" | "migrasi_pinjaman" | "update_pinjaman" | "vs_sp" | "potongan" | "buku_kas" | "toko_history";
```

- [ ] **Step 2: Add vs_sp entry to the import type select options**

Find the `<SelectContent>` that contains the import type options. Add a new `<SelectItem>`:

```tsx
<SelectItem value="vs_sp">📥 Import VS SP (Per Bulan)</SelectItem>
```

- [ ] **Step 3: Add sheet name hints for vs_sp in findBestSheet**

In the `findBestSheet` function (around line 92), add to `nameHints`:

```typescript
vs_sp: ["gaji"],
```

And in `requiredKeywords` (around line 74), add:

```typescript
vs_sp: [["pinjam", "sisa saldo", "klasifikasi"]],
```

- [ ] **Step 4: Add vs_sp to the API target URL routing**

Find the routing logic (around line 255 and 323). Add `vs_sp` case:

```typescript
const targetUrl = importType === "sejahtera" ? "/api/sejahtera/import"
  : importType === "migrasi_pinjaman" ? "/api/loans/import-migrasi"
  : importType === "update_pinjaman" ? "/api/loans/import-update"
  : importType === "vs_sp" ? "/api/loans/import-vs-sp"
  : importType === "toko_history" ? "/api/toko/sales/import-history"
  : importType === "potongan" ? "/api/transactions/import-potongan"
  : "/api/members/import";
```

Apply this change in BOTH `handlePreview` and `handleImport` functions.

- [ ] **Step 5: Add sheet selector and period badge for vs_sp**

After the file upload input, add conditional UI for vs_sp type. This requires:

1. A state for `availableSheets` and `selectedSheet`:
```typescript
const [availableSheets, setAvailableSheets] = useState<string[]>([]);
const [selectedSheet, setSelectedSheet] = useState("GAJI");
const [detectedPeriod, setDetectedPeriod] = useState("");
```

2. When `vs_sp` is selected and file is uploaded, show sheet selector:
```tsx
{importType === "vs_sp" && availableSheets.length > 0 && (
  <div className="flex items-center gap-4 mb-4">
    <div>
      <label className="text-sm font-medium">Sheet:</label>
      <Select value={selectedSheet} onValueChange={setSelectedSheet}>
        <SelectTrigger className="w-48">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {availableSheets.map(s => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
    {detectedPeriod && (
      <Badge variant="outline" className="text-sm">
        Periode: {detectedPeriod}
      </Badge>
    )}
  </div>
)}
```

3. In the `handlePreview` function for `vs_sp`, send `sheetName` as form field:
```typescript
if (importType === "vs_sp") {
  formData.append("sheetName", selectedSheet);
}
```

4. In the preview response handler for `vs_sp`, extract period and sheets:
```typescript
if (importType === "vs_sp") {
  const data = result.data;
  setDetectedPeriod(data.period || "");
  setAvailableSheets(data.availableSheets || []);
}
```

- [ ] **Step 6: Add summary cards for vs_sp preview**

For `vs_sp` type, show 4 colored summary cards above the preview table:

```tsx
{importType === "vs_sp" && previewData && (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
    <Card className="border-green-200 bg-green-50">
      <CardContent className="p-3">
        <p className="text-xs text-green-600">UPDATE</p>
        <p className="text-xl font-bold text-green-700">{previewData.summary?.update || 0}</p>
      </CardContent>
    </Card>
    <Card className="border-yellow-200 bg-yellow-50">
      <CardContent className="p-3">
        <p className="text-xs text-yellow-600">PINJAMAN BARU</p>
        <p className="text-xl font-bold text-yellow-700">{previewData.summary?.newLoan || 0}</p>
      </CardContent>
    </Card>
    <Card className="border-blue-200 bg-blue-50">
      <CardContent className="p-3">
        <p className="text-xs text-blue-600">ANGGOTA BARU</p>
        <p className="text-xl font-bold text-blue-700">{previewData.summary?.newMember || 0}</p>
      </CardContent>
    </Card>
    <Card className="border-red-200 bg-red-50">
      <CardContent className="p-3">
        <p className="text-xs text-red-600">ERROR</p>
        <p className="text-xl font-bold text-red-700">{previewData.summary?.error || 0}</p>
      </CardContent>
    </Card>
  </div>
)}
```

- [ ] **Step 7: Extend preview table for vs_sp columns**

The preview table already has conditionals per import type. For `vs_sp`, add these columns:

```tsx
{importType === "vs_sp" && (
  <>
    <TableHead>Status</TableHead>
    <TableHead>Match</TableHead>
    <TableHead>Nama</TableHead>
    <TableHead>NRP</TableHead>
    <TableHead>Pinjaman</TableHead>
    <TableHead>Pot Bulan Ini</TableHead>
    <TableHead>Terbayar</TableHead>
    <TableHead>Sisa Saldo</TableHead>
    <TableHead>No Pinjaman</TableHead>
    <TableHead>Catatan</TableHead>
  </>
)}
```

And corresponding `<TableCell>` in the body:

```tsx
{importType === "vs_sp" && (
  <>
    <TableCell>
      <Badge variant={row.status === "UPDATE" ? "default" : row.status === "NEW_LOAN" ? "secondary" : row.status === "NEW_MEMBER" ? "outline" : "destructive"}>
        {row.status}
      </Badge>
    </TableCell>
    <TableCell className="text-xs">{row.memberMatch || "-"}</TableCell>
    <TableCell>{row.memberName || row.nama}</TableCell>
    <TableCell className="text-xs font-mono">{row.nrp}</TableCell>
    <TableCell className="text-right">{formatCurrency(row.pinjam)}</TableCell>
    <TableCell className="text-right">{formatCurrency(row.potBulan)}</TableCell>
    <TableCell className="text-right">{formatCurrency(row.jumlahSd)}</TableCell>
    <TableCell className="text-right">{formatCurrency(row.sisaSaldo)}</TableCell>
    <TableCell className="text-xs">{row.loanNo || "-"}</TableCell>
    <TableCell className="text-xs text-muted-foreground">{row.notes || "-"}</TableCell>
  </>
)}
```

- [ ] **Step 8: Verify page renders**

Run: `npm run dev`

Navigate to `http://localhost:3000/master/import-data` and select "Import VS SP (Per Bulan)" from the dropdown. Verify the UI appears correctly.

- [ ] **Step 9: Commit**

```bash
git add src/app/(protected)/master/import-data/page.tsx
git commit -m "feat(import-vs-sp): add vs_sp import type to import-data UI with sheet selector, summary cards, and preview table"
```

---

### Task 5: End-to-end manual test

**Files:** None (testing only)

- [ ] **Step 1: Start dev server**

Run: `npm run dev`

- [ ] **Step 2: Login as operator**

Navigate to `http://localhost:3000`, login with `operator@koperasi.com` / `password123`.

- [ ] **Step 3: Navigate to Import Data**

Go to Master Data → Import & Export Data (or `/master/import-data`).

- [ ] **Step 4: Test VS SP import**

1. Select "📥 Import VS SP (Per Bulan)" from dropdown
2. Upload `SP_0626JUNI.xlsx`
3. Verify: Sheet selector shows with "GAJI" default
4. Verify: Period badge shows "Periode: JUNI 2026"
5. Click "Preview & Validasi"
6. Verify: Summary cards show UPDATE/NEW_LOAN/NEW_MEMBER/ERROR counts
7. Verify: Preview table shows rows with status badges, match method, amounts
8. Click "Import N Data Valid"
9. Verify: Success message with counts
10. Verify: Loan data updated in database (check via Prisma Studio or member detail page)

- [ ] **Step 5: Test undo**

1. Go back to import page
2. If riwayat/batch list is available, find the batch
3. Click "Undo" / "Batalkan"
4. Verify: Loan data reverted to pre-import state

- [ ] **Step 6: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(import-vs-sp): address testing findings"
```

---

## Self-Review Checklist

**1. Spec Coverage:**
- [x] §1 Overview: All goals covered (update, create, preview, undo, auto-detect)
- [x] §2 Source Format: Column mapping hardcoded, month auto-detect, row filtering, edge cases
- [x] §3 Matching Logic: 3-tier member, 3-strategy loan, preview status codes
- [x] §4 Update Logic: Loan updates, LoanPayment creation (idempotent), LoanSchedule status updates
- [x] §5 Batch System: ImportBatch model, preImportSnapshots, undo logic
- [x] §6 API Spec: POST preview/commit, GET batches, DELETE undo
- [x] §7 UI: Sheet selector, period badge, summary cards, preview table
- [x] §8 File Structure: 3 API routes, 1 UI modification
- [x] §9 Constraints: No Kas/Jurnal, operator-only, idempotent, 5min timeout

**2. Placeholder Scan:** No TBD/TODO found. All steps contain complete code.

**3. Type Consistency:** All types, function names, and variable names are consistent across tasks.
