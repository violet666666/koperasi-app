# Payroll Slip Gaji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import BRI payroll Excel files, store per-member per-period data with all 30+ deduction categories, display with internal koperasi calculations, and print AMPLOP-style payslips for members.

**Architecture:** New `PayrollPeriod` + `PayrollSlip` Prisma models. Upload Excel → parse POT GAJI sheet with dynamic header mapping → store structured koperasi deductions + JSON blob for other deductions → UI pages for operator management + member portal self-service. Print via browser `window.print()` with print-specific CSS.

**Tech Stack:** Next.js App Router, Prisma, SheetJS (xlsx), shadcn/ui, Tailwind CSS, React Query

**Spec:** `docs/superpowers/specs/2026-05-04-payroll-slip-gaji-design.md`

---

## File Structure

| File | Action | Purpose |
|------|--------|---------|
| `prisma/schema.prisma` | Modify | Add `PayrollPeriod` + `PayrollSlip` models |
| `src/app/api/payroll/import/route.ts` | Create | Import Excel BRI, parse POT GAJI sheet |
| `src/app/api/payroll/route.ts` | Create | List all payroll periods |
| `src/app/api/payroll/[periodId]/route.ts` | Create | Get period detail + slips |
| `src/app/api/payroll/[periodId]/slip/[slipId]/route.ts` | Create | Get single slip for print |
| `src/app/(protected)/gaji/page.tsx` | Create | Period list page with import modal |
| `src/app/(protected)/gaji/[periodId]/page.tsx` | Create | Period detail with member table |
| `src/app/(protected)/gaji/[periodId]/slip/[slipId]/page.tsx` | Create | Slip preview & print |
| `src/app/portal/gaji/page.tsx` | Create | Member self-service portal |
| `src/lib/constants/navigation.ts` | Modify | Add "Gaji & Slip" nav item |

---

## Task 1: Prisma Schema & Migration

**Files:**
- Modify: `prisma/schema.prisma` (append before closing lines)

- [ ] **Step 1: Add models to schema**

Append these models at the end of `prisma/schema.prisma`, before any closing brackets:

```prisma
// =================================================================
// PAYROLL — Slip Gaji & Potongan dari BRI
// =================================================================

model PayrollPeriod {
  id            Int      @id @default(autoincrement())
  periodName    String                          // "Mei 2026"
  periodMonth   Int                             // 5
  periodYear    Int                             // 2026
  sourceFile    String?                         // "5. GAJI MEI 2026 POLRES.xls"
  sourceType    String   @default("polres")     // polres / polsek
  status        String   @default("draft")      // draft / processed
  totalMembers  Int      @default(0)
  totalGaji     Decimal  @default(0) @db.Decimal(15, 2)
  totalPotongan Decimal  @default(0) @db.Decimal(15, 2)
  createdById   Int
  createdAt     DateTime @default(now())
  createdBy     User     @relation(fields: [createdById], references: [id])
  slips         PayrollSlip[]

  @@unique([periodMonth, periodYear, sourceType])
  @@map("payroll_periods")
}

model PayrollSlip {
  id          Int      @id @default(autoincrement())
  periodId    Int
  period      PayrollPeriod @relation(fields: [periodId], references: [id], onDelete: Cascade)
  memberId    Int?
  member      Member?  @relation(fields: [memberId], references: [id])

  // Identifikasi
  nrp         String
  nama        String
  pangkat     String?

  // Gaji (dari Excel)
  gajiBersih  Decimal  @db.Decimal(15, 2)
  tunkin      Decimal  @default(0) @db.Decimal(15, 2)

  // Potongan Koperasi Primkoppol (structured — untuk kalkulasi internal)
  potTajib        Decimal @default(0) @db.Decimal(15, 2)
  potSP           Decimal @default(0) @db.Decimal(15, 2)
  potBarang       Decimal @default(0) @db.Decimal(15, 2)
  potSukarela     Decimal @default(0) @db.Decimal(15, 2)
  potKoperasiLain Decimal @default(0) @db.Decimal(15, 2)

  // Kalkulasi internal koperasi
  totalPotKoperasi Decimal @default(0) @db.Decimal(15, 2)
  sisaGaji         Decimal @default(0) @db.Decimal(15, 2)
  sisaTunkin       Decimal @default(0) @db.Decimal(15, 2)

  // Semua potongan lain (JSON — display saja)
  otherDeductions  Json?

  // Total dari BRI (langsung dari Excel)
  jumlahPotNonBRI  Decimal @default(0) @db.Decimal(15, 2)
  jumlahPotBRI     Decimal @default(0) @db.Decimal(15, 2)
  terimaBersih     Decimal @default(0) @db.Decimal(15, 2)
  sisaRekening     Decimal @default(0) @db.Decimal(15, 2)
  bisaDiambilATM   Decimal @default(0) @db.Decimal(15, 2)

  createdAt DateTime @default(now())

  @@unique([periodId, nrp])
  @@index([memberId])
  @@map("payroll_slips")
}
```

Also add the reverse relations to existing models. On the `User` model, add:
```prisma
payrollPeriods PayrollPeriod[]
```

On the `Member` model, add:
```prisma
payrollSlips PayrollSlip[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma db push
```

Expected: Schema synchronized, no errors.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add PayrollPeriod and PayrollSlip models for payroll slip gaji"
```

---

## Task 2: Import API — Parse POT GAJI Sheet

**Files:**
- Create: `src/app/api/payroll/import/route.ts`

This is the core import route. It parses the POT GAJI sheet with **dynamic header mapping** — reading column names from the header row and matching them to known deduction categories.

- [ ] **Step 1: Create the import route**

Create `src/app/api/payroll/import/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export const maxDuration = 300;

// Koperasi-specific deduction keywords (mapped to structured fields)
const KOPERASI_FIELDS: Record<string, keyof Pick<SlipData, "potTajib" | "potSP" | "potBarang" | "potSukarela" | "potKoperasiLain">> = {
    "TAJIP": "potTajib",
    "TAJIB": "potTajib",
    "TABUNGAN WAJIB": "potTajib",
    "SP PRIMKOPPOL": "potSP",
    "SP PRIM": "potSP",
    "ANGSURAN SP": "potSP",
    "BARANG PRIMKOPPOL": "potBarang",
    "BARANG PRIM": "potBarang",
    "SUKARELA": "potSukarela",
    "SIMPANAN SUKARELA": "potSukarela",
    "SIMPedes KOPERASI": "potKoperasiLain",
    "KOPERASI BHY": "potKoperasiLain",
    "KANTIN": "potKoperasiLain",
};

// Summary field keywords (mapped to BRI total fields)
const SUMMARY_FIELDS: Record<string, keyof Pick<SlipData, "jumlahPotNonBRI" | "jumlahPotBRI" | "terimaBersih">> = {
    "JUMLAH POT NON": "jumlahPotNonBRI",
    "JUMLAH POTONGAN NON": "jumlahPotNonBRI",
    "JML POT NON": "jumlahPotNonBRI",
    "JUMLAH POT KRETAP": "jumlahPotBRI",
    "JUMLAH POTONGAN BRI": "jumlahPotBRI",
    "JML POT BRI": "jumlahPotBRI",
    "JUMLAH GAJI DITERIMA": "terimaBersih",
    "JML GAJI DITERIMA": "terimaBersih",
    "GAJI DITERIMA": "terimaBersih",
    "DITERIMA": "terimaBersima",
};

// Identity field keywords
const IDENTITY_FIELDS: Record<string, "no" | "pangkat" | "nama" | "nrp" | "gajiBersih"> = {
    "NO": "no",
    "PANGKAT": "pangkat",
    "NAMA": "nama",
    "NRP": "nrp",
    "NIP": "nrp",
    "NRP/NIP": "nrp",
    "JML GAJI": "gajiBersih",
    "GAJI BERSIH": "gajiBersih",
    "JUMLAH GAJI": "gajiBersih",
};

interface SlipData {
    nrp: string;
    nama: string;
    pangkat: string;
    gajiBersih: number;
    tunkin: number;
    potTajib: number;
    potSP: number;
    potBarang: number;
    potSukarela: number;
    potKoperasiLain: number;
    totalPotKoperasi: number;
    sisaGaji: number;
    sisaTunkin: number;
    otherDeductions: Record<string, number>;
    jumlahPotNonBRI: number;
    jumlahPotBRI: number;
    terimaBersih: number;
    sisaRekening: number;
    bisaDiambilATM: number;
    memberId: number | null;
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null) return 0;
    if (typeof raw === "number") return raw;
    const s = String(raw).trim();
    if (s === "-" || s === "" || s === "Rp" || s === "Rp.") return 0;
    const cleaned = s.replace(/[^0-9.\-]/g, "");
    const num = parseFloat(cleaned);
    return isNaN(num) ? 0 : num;
}

function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, "").replace(/\.0$/, "").trim();
}

function normalizeHeader(h: string): string {
    return String(h).toUpperCase().trim().replace(/[^A-Z0-9\s/]/g, "").replace(/\s+/g, " ");
}

function matchKeyword(header: string, keywords: Record<string, any>): string | null {
    const normalized = normalizeHeader(header);
    for (const [keyword, value] of Object.entries(keywords)) {
        if (normalized.includes(keyword)) return value;
    }
    return null;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (roleName !== "operator" && roleName !== "admin" && roleName !== "super_admin") {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }
        const adminId = Number(session.user.id);

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";
        const sourceType = (formData.get("sourceType") as string) || "polres";

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: "buffer" });

        // Find POT GAJI sheet
        let sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("POT GAJI"));
        if (!sheetName) {
            sheetName = workbook.SheetNames.find(s => s.toUpperCase().includes("POTONGAN"));
        }
        if (!sheetName) {
            return NextResponse.json({ message: "Sheet 'POT GAJI' tidak ditemukan dalam file" }, { status: 400 });
        }

        const ws = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" }) as string[][];

        if (rows.length < 3) {
            return NextResponse.json({ message: "Sheet kosong" }, { status: 400 });
        }

        // Find header row (look for row containing NRP or NAMA)
        let headerRowIdx = -1;
        for (let i = 0; i < Math.min(10, rows.length); i++) {
            const rowStr = rows[i].join(" ").toUpperCase();
            if ((rowStr.includes("NRP") || rowStr.includes("NIP")) && rowStr.includes("NAMA")) {
                headerRowIdx = i;
                break;
            }
        }
        if (headerRowIdx === -1) {
            return NextResponse.json({ message: "Header row tidak ditemukan. Pastikan sheet memiliki kolom NRP dan NAMA." }, { status: 400 });
        }

        const headerRow = rows[headerRowIdx];

        // Build column mapping from header
        const colMap: Record<number, { type: string; field?: string }> = {};
        for (let col = 0; col < headerRow.length; col++) {
            const header = String(headerRow[col] || "").trim();
            if (!header) continue;

            // Check identity fields
            const identityField = matchKeyword(header, IDENTITY_FIELDS);
            if (identityField) {
                colMap[col] = { type: "identity", field: identityField };
                continue;
            }

            // Check koperasi fields
            const koperasiField = matchKeyword(header, KOPERASI_FIELDS);
            if (koperasiField) {
                colMap[col] = { type: "koperasi", field: koperasiField };
                continue;
            }

            // Check summary fields
            const summaryField = matchKeyword(header, SUMMARY_FIELDS);
            if (summaryField) {
                colMap[col] = { type: "summary", field: summaryField };
                continue;
            }

            // Check for BRI columns (skip — these are in otherDeductions)
            const normalizedHeader = normalizeHeader(header);
            if (normalizedHeader.includes("BRI") || normalizedHeader.includes("SUDIRMAN") || normalizedHeader.includes("CABANG") || normalizedHeader.includes("UNIT LAIN")) {
                colMap[col] = { type: "bri", field: header };
                continue;
            }

            // Everything else is "other deduction"
            // Skip columns that are clearly not deductions (NO, sequence numbers, etc.)
            if (!["NO", "URUT", "KETERANGAN", "KET", "REKENING", "NO REK", "NPWP"].some(skip => normalizedHeader.includes(skip))) {
                colMap[col] = { type: "other", field: header };
            }
        }

        // Parse period from file name (e.g., "5. GAJI MEI 2026 POLRES.xls")
        const fileName = file.name;
        const monthNames = ["JANUARI", "FEBRUARI", "MARET", "APRIL", "MEI", "JUNI", "JULI", "AGUSTUS", "SEPTEMBER", "OKTOBER", "NOVEMBER", "DESEMBER"];
        let periodMonth = new Date().getMonth() + 1;
        let periodYear = new Date().getFullYear();
        for (let m = 0; m < monthNames.length; m++) {
            if (fileName.toUpperCase().includes(monthNames[m])) {
                periodMonth = m + 1;
                break;
            }
        }
        const yearMatch = fileName.match(/(20\d{2})/);
        if (yearMatch) periodYear = parseInt(yearMatch[1]);
        const periodName = `${monthNames[periodMonth - 1].charAt(0) + monthNames[periodMonth - 1].slice(1).toLowerCase()} ${periodYear}`;

        // Load members for matching
        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true, tunlesKinerja: true },
        });

        // Parse data rows
        const slips: SlipData[] = [];
        let failCount = 0;

        for (let i = headerRowIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            if (!row || row.length < 3) continue;

            // Extract identity
            let nrp = "";
            let nama = "";
            let pangkat = "";
            let gajiBersih = 0;

            for (const [colStr, mapping] of Object.entries(colMap)) {
                const col = parseInt(colStr);
                if (mapping.type !== "identity" || !mapping.field) continue;
                const val = row[col];
                if (mapping.field === "nrp") nrp = cleanNrp(String(val || ""));
                else if (mapping.field === "nama") nama = String(val || "").trim();
                else if (mapping.field === "pangkat") pangkat = String(val || "").trim();
                else if (mapping.field === "gajiBersih") gajiBersih = cleanNumber(val);
            }

            // Skip empty/header/total rows
            if (!nama || nama.toUpperCase() === "NAMA" || nama.toUpperCase().includes("JUMLAH") || nama.toUpperCase().includes("TOTAL")) continue;
            if (!nrp && !nama) continue;
            if (/^\d+(\.\d+)?$/.test(nama)) continue;

            // Build slip data
            const otherDeductions: Record<string, number> = {};
            const slip: SlipData = {
                nrp, nama, pangkat, gajiBersih,
                tunkin: 0,
                potTajib: 0, potSP: 0, potBarang: 0, potSukarela: 0, potKoperasiLain: 0,
                totalPotKoperasi: 0, sisaGaji: 0, sisaTunkin: 0,
                otherDeductions,
                jumlahPotNonBRI: 0, jumlahPotBRI: 0,
                terimaBersih: 0, sisaRekening: 100000, bisaDiambilATM: 0,
                memberId: null,
            };

            // Map deduction columns
            for (const [colStr, mapping] of Object.entries(colMap)) {
                const col = parseInt(colStr);
                const val = cleanNumber(row[col]);

                if (mapping.type === "koperasi" && mapping.field) {
                    (slip as any)[mapping.field] = val;
                } else if (mapping.type === "summary" && mapping.field) {
                    (slip as any)[mapping.field] = val;
                } else if (mapping.type === "other" || mapping.type === "bri") {
                    if (mapping.field) otherDeductions[mapping.field] = val;
                }
            }

            // Match member
            let member = nrp ? allMembers.find(m => m.nrp === nrp || m.memberNo === nrp) : null;
            if (!member && nama) {
                const cleanNama = nama.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
                member = allMembers.find(m => {
                    const mClean = m.name.toUpperCase().replace(/[^A-Z\s]/g, "").trim();
                    return mClean === cleanNama || mClean.includes(cleanNama) || cleanNama.includes(mClean);
                });
            }

            slip.memberId = member?.id || null;
            slip.tunkin = member?.tunlesKinerja ? Number(member.tunlesKinerja) : 0;

            // Internal koperasi calculation
            slip.totalPotKoperasi = slip.potTajib + slip.potSP + slip.potBarang + slip.potSukarela + slip.potKoperasiLain;
            slip.sisaGaji = Math.max(0, slip.gajiBersih - slip.totalPotKoperasi);
            slip.sisaTunkin = Math.max(0, slip.tunkin);
            slip.bisaDiambilATM = Math.max(0, slip.terimaBersih - slip.sisaRekening);

            slips.push(slip);
        }

        // Preview mode — return parsed data without saving
        if (mode === "preview") {
            return NextResponse.json({
                data: {
                    mode: "preview",
                    sheetName,
                    periodName,
                    periodMonth,
                    periodYear,
                    sourceFile: fileName,
                    sourceType,
                    totalRows: slips.length,
                    success: slips.length,
                    failed: failCount,
                    preview: slips.slice(0, 50).map((s, idx) => ({
                        row: idx + 1,
                        nrp: s.nrp,
                        nama: s.nama,
                        pangkat: s.pangkat,
                        gajiBersih: s.gajiBersih,
                        potTajib: s.potTajib,
                        potSP: s.potSP,
                        potBarang: s.potBarang,
                        totalPotKoperasi: s.totalPotKoperasi,
                        sisaGaji: s.sisaGaji,
                        terimaBersih: s.terimaBersih,
                        memberId: s.memberId,
                        status: s.memberId ? "valid" : "no_match",
                    })),
                    columnCount: Object.keys(colMap).length,
                    headers: headerRow.filter((h: string) => h && String(h).trim()),
                },
            });
        }

        // Commit mode — save to database
        // Check for duplicate period
        const existing = await prisma.payrollPeriod.findUnique({
            where: { periodMonth_periodYear_sourceType: { periodMonth, periodYear, sourceType } },
        });
        if (existing) {
            return NextResponse.json({
                message: `Data gaji ${periodName} (${sourceType}) sudah ada. Hapus terlebih dahulu jika ingin import ulang.`,
                existingPeriodId: existing.id,
            }, { status: 409 });
        }

        const period = await prisma.payrollPeriod.create({
            data: {
                periodName,
                periodMonth,
                periodYear,
                sourceFile: fileName,
                sourceType,
                status: "processed",
                totalMembers: slips.length,
                totalGaji: slips.reduce((sum, s) => sum + s.gajiBersih, 0),
                totalPotongan: slips.reduce((sum, s) => sum + s.totalPotKoperasi, 0),
                createdById: adminId,
            },
        });

        // Batch insert slips
        const BATCH = 100;
        for (let i = 0; i < slips.length; i += BATCH) {
            const batch = slips.slice(i, i + BATCH);
            await prisma.payrollSlip.createMany({
                data: batch.map(s => ({
                    periodId: period.id,
                    memberId: s.memberId,
                    nrp: s.nrp,
                    nama: s.nama,
                    pangkat: s.pangkat,
                    gajiBersih: s.gajiBersih,
                    tunkin: s.tunkin,
                    potTajib: s.potTajib,
                    potSP: s.potSP,
                    potBarang: s.potBarang,
                    potSukarela: s.potSukarela,
                    potKoperasiLain: s.potKoperasiLain,
                    totalPotKoperasi: s.totalPotKoperasi,
                    sisaGaji: s.sisaGaji,
                    sisaTunkin: s.sisaTunkin,
                    otherDeductions: s.otherDeductions,
                    jumlahPotNonBRI: s.jumlahPotNonBRI,
                    jumlahPotBRI: s.jumlahPotBRI,
                    terimaBersih: s.terimaBersih,
                    sisaRekening: s.sisaRekening,
                    bisaDiambilATM: s.bisaDiambilATM,
                })),
            });
        }

        // Audit
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "IMPORT", module: "Payroll",
                description: `Import gaji ${periodName}: ${slips.length} anggota`,
                newData: { periodId: period.id, totalMembers: slips.length },
            });
        } catch (e) {}

        return NextResponse.json({
            data: {
                mode: "commit",
                periodId: period.id,
                periodName,
                totalRows: slips.length,
                success: slips.length,
                failed: failCount,
            },
        });
    } catch (error: any) {
        console.error("POST /api/payroll/import error:", error);
        return NextResponse.json({ message: "Gagal memproses file gaji: " + error.message }, { status: 500 });
    }
}
```

- [ ] **Step 2: Verify compilation**

```bash
npx tsc --noEmit --pretty 2>&1 | grep "payroll" || echo "No errors"
```

Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/payroll/import/route.ts
git commit -m "feat: add payroll import API with dynamic POT GAJI sheet parsing"
```

---

## Task 3: Period List & Detail API Routes

**Files:**
- Create: `src/app/api/payroll/route.ts`
- Create: `src/app/api/payroll/[periodId]/route.ts`
- Create: `src/app/api/payroll/[periodId]/slip/[slipId]/route.ts`

- [ ] **Step 1: Create period list route**

Create `src/app/api/payroll/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const periods = await prisma.payrollPeriod.findMany({
            orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
            include: {
                createdBy: { select: { name: true } },
                _count: { select: { slips: true } },
            },
        });

        return NextResponse.json({
            data: periods.map(p => ({
                id: p.id,
                periodName: p.periodName,
                periodMonth: p.periodMonth,
                periodYear: p.periodYear,
                sourceFile: p.sourceFile,
                sourceType: p.sourceType,
                status: p.status,
                totalMembers: p.totalMembers,
                totalGaji: Number(p.totalGaji),
                totalPotongan: Number(p.totalPotongan),
                createdByName: p.createdBy?.name,
                createdAt: p.createdAt,
                slipCount: p._count.slips,
            })),
        });
    } catch (error: any) {
        console.error("GET /api/payroll error:", error);
        return NextResponse.json({ message: "Gagal memuat data payroll" }, { status: 500 });
    }
}

// DELETE — remove a payroll period and all its slips
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { periodId } = await request.json();
        if (!periodId) {
            return NextResponse.json({ message: "periodId wajib" }, { status: 400 });
        }

        await prisma.payrollPeriod.delete({ where: { id: periodId } });
        return NextResponse.json({ message: "Periode gaji berhasil dihapus" });
    } catch (error: any) {
        console.error("DELETE /api/payroll error:", error);
        return NextResponse.json({ message: "Gagal menghapus periode gaji" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Create period detail route**

Create `src/app/api/payroll/[periodId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ periodId: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { periodId } = await params;
        const id = parseInt(periodId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid periodId" }, { status: 400 });
        }

        const period = await prisma.payrollPeriod.findUnique({
            where: { id },
            include: {
                createdBy: { select: { name: true } },
                slips: {
                    orderBy: { nama: "asc" },
                    include: {
                        member: { select: { id: true, name: true, nrp: true } },
                    },
                },
            },
        });

        if (!period) {
            return NextResponse.json({ message: "Periode tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({
            data: {
                period: {
                    id: period.id,
                    periodName: period.periodName,
                    periodMonth: period.periodMonth,
                    periodYear: period.periodYear,
                    sourceFile: period.sourceFile,
                    sourceType: period.sourceType,
                    status: period.status,
                    totalMembers: period.totalMembers,
                    totalGaji: Number(period.totalGaji),
                    totalPotongan: Number(period.totalPotongan),
                    createdByName: period.createdBy?.name,
                    createdAt: period.createdAt,
                },
                slips: period.slips.map(s => ({
                    id: s.id,
                    nrp: s.nrp,
                    nama: s.nama,
                    pangkat: s.pangkat,
                    gajiBersih: Number(s.gajiBersih),
                    tunkin: Number(s.tunkin),
                    potTajib: Number(s.potTajib),
                    potSP: Number(s.potSP),
                    potBarang: Number(s.potBarang),
                    potSukarela: Number(s.potSukarela),
                    potKoperasiLain: Number(s.potKoperasiLain),
                    totalPotKoperasi: Number(s.totalPotKoperasi),
                    sisaGaji: Number(s.sisaGaji),
                    sisaTunkin: Number(s.sisaTunkin),
                    otherDeductions: s.otherDeductions,
                    jumlahPotNonBRI: Number(s.jumlahPotNonBRI),
                    jumlahPotBRI: Number(s.jumlahPotBRI),
                    terimaBersih: Number(s.terimaBersih),
                    sisaRekening: Number(s.sisaRekening),
                    bisaDiambilATM: Number(s.bisaDiambilATM),
                    memberId: s.memberId,
                    memberName: s.member?.name,
                })),
            },
        });
    } catch (error: any) {
        console.error("GET /api/payroll/[periodId] error:", error);
        return NextResponse.json({ message: "Gagal memuat detail periode" }, { status: 500 });
    }
}
```

- [ ] **Step 3: Create single slip route**

Create `src/app/api/payroll/[periodId]/slip/[slipId]/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ periodId: string; slipId: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { periodId, slipId } = await params;
        const id = parseInt(slipId);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid slipId" }, { status: 400 });
        }

        const slip = await prisma.payrollSlip.findUnique({
            where: { id },
            include: {
                period: true,
                member: { select: { id: true, name: true, nrp: true } },
            },
        });

        if (!slip) {
            return NextResponse.json({ message: "Slip tidak ditemukan" }, { status: 404 });
        }

        return NextResponse.json({
            data: {
                id: slip.id,
                period: {
                    id: slip.period.id,
                    periodName: slip.period.periodName,
                    periodMonth: slip.period.periodMonth,
                    periodYear: slip.period.periodYear,
                },
                nrp: slip.nrp,
                nama: slip.nama,
                pangkat: slip.pangkat,
                gajiBersih: Number(slip.gajiBersih),
                tunkin: Number(slip.tunkin),
                potTajib: Number(slip.potTajib),
                potSP: Number(slip.potSP),
                potBarang: Number(slip.potBarang),
                potSukarela: Number(slip.potSukarela),
                potKoperasiLain: Number(slip.potKoperasiLain),
                totalPotKoperasi: Number(slip.totalPotKoperasi),
                sisaGaji: Number(slip.sisaGaji),
                sisaTunkin: Number(slip.sisaTunkin),
                otherDeductions: slip.otherDeductions as Record<string, number> | null,
                jumlahPotNonBRI: Number(slip.jumlahPotNonBRI),
                jumlahPotBRI: Number(slip.jumlahPotBRI),
                terimaBersih: Number(slip.terimaBersih),
                sisaRekening: Number(slip.sisaRekening),
                bisaDiambilATM: Number(slip.bisaDiambilATM),
                memberId: slip.memberId,
            },
        });
    } catch (error: any) {
        console.error("GET /api/payroll/[periodId]/slip/[slipId] error:", error);
        return NextResponse.json({ message: "Gagal memuat slip" }, { status: 500 });
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payroll/
git commit -m "feat: add payroll period list, detail, and slip API routes"
```

---

## Task 4: Period List Page (`/gaji`)

**Files:**
- Create: `src/app/(protected)/gaji/page.tsx`
- Modify: `src/lib/constants/navigation.ts` — add nav item

- [ ] **Step 1: Add navigation item**

In `src/lib/constants/navigation.ts`, add a new entry in the appropriate section (near the Laporan group):

```typescript
// Add this child to the Laporan group's children array:
{ title: "Gaji & Slip", href: "/gaji" },
```

- [ ] **Step 2: Create the period list page**

Create `src/app/(protected)/gaji/page.tsx` — a "use client" page following the existing `faktur-potongan/page.tsx` pattern. Key features:
- Fetch periods from `GET /api/payroll`
- Display in a table with columns: Periode, File Sumber, Tipe, Anggota, Total Gaji, Status, Aksi
- Import modal: upload Excel file, select source type (POLRES/POLSEK), preview, commit
- Delete confirmation dialog
- Uses `PageHeader`, `Card`, `Table`, `Dialog`, `Button` from shadcn/ui
- Uses `useAuth` for permission check
- Import flow: file upload → `POST /api/payroll/import?mode=preview` → show preview → `POST /api/payroll/import?mode=commit`

This page follows the same pattern as `src/app/(protected)/master/import-data/page.tsx` for the import modal and `src/app/(protected)/laporan/faktur-potongan/page.tsx` for the table layout.

- [ ] **Step 3: Commit**

```bash
git add src/app/(protected)/gaji/page.tsx src/lib/constants/navigation.ts
git commit -m "feat: add payroll period list page with import modal"
```

---

## Task 5: Period Detail Page (`/gaji/[periodId]`)

**Files:**
- Create: `src/app/(protected)/gaji/[periodId]/page.tsx`

- [ ] **Step 1: Create the detail page**

Create `src/app/(protected)/gaji/[periodId]/page.tsx` — "use client" page. Key features:
- Fetch from `GET /api/payroll/[periodId]`
- Summary cards at top: Total Anggota, Total Gaji, Total Potongan Koperasi, Rata-rata Sisa Gaji
- Table with columns: No | NRP | Nama | Pangkat | Gaji Bersih | TAJIB | SP | Barang | Total Pot Kop | Sisa Gaji | Terima Bersih | Aksi
- Search/filter by NRP/Nama
- "Cetak Semua Slip" button (opens first slip in new tab for batch printing)
- Each row has "Lihat Slip" link → navigates to `/gaji/[periodId]/slip/[slipId]`
- Uses `formatCurrency` from `@/lib/constants` for number formatting
- Pagination for large datasets (50 per page)

- [ ] **Step 2: Commit**

```bash
git add src/app/(protected)/gaji/[periodId]/page.tsx
git commit -m "feat: add payroll period detail page with member table"
```

---

## Task 6: Slip Preview & Print Page (`/gaji/[periodId]/slip/[slipId]`)

**Files:**
- Create: `src/app/(protected)/gaji/[periodId]/slip/[slipId]/page.tsx`

This is the AMPLOP-style payslip page with print CSS.

- [ ] **Step 1: Create the slip page**

Create `src/app/(protected)/gaji/[periodId]/slip/[slipId]/page.tsx` — "use client" page. Key features:
- Fetch from `GET /api/payroll/[periodId]/slip/[slipId]`
- Render the AMPLOP-style layout from the spec (see spec "Slip Layout" section)
- Three sections:
  1. **Potongan Koperasi** (from structured fields: potTajib, potSP, potBarang, etc.)
  2. **Potongan Lainnya** (iterate over `otherDeductions` JSON object)
  3. **Ringkasan BRI** (jumlahPotNonBRI, jumlahPotBRI, terimaBersih, sisaRekening, bisaDiambilATM)
  4. **Internal Koperasi** (sisaGaji, sisaTunkin — marked with asterisk)
- Signature section at bottom: Ketua Koperasi, Bendahara
- "Cetak" button calls `window.print()`
- Print CSS: hide navigation/buttons, show only slip content, page break after each slip
- Uses thermal receipt printing CSS pattern already established in the codebase (`@media print` with specific rules)

- [ ] **Step 2: Add print CSS**

Add print-specific styles using `@media print` in the page component (or a dedicated CSS module). Follow the pattern from existing thermal receipt printing:
- Hide sidebar, header, buttons
- Set page size to A4 or A5 (half-page for envelope-sized slips)
- No page-break-inside on slip container
- Black text on white background

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/gaji/[periodId]/slip/[slipId]/page.tsx"
git commit -m "feat: add payroll slip preview and print page with AMPLOP-style layout"
```

---

## Task 7: Portal Anggota (`/portal/gaji`)

**Files:**
- Create: `src/app/portal/gaji/page.tsx`
- Create: `src/app/api/member-portal/payroll/route.ts`

- [ ] **Step 1: Create portal API route**

Create `src/app/api/member-portal/payroll/route.ts`:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const member = await prisma.member.findUnique({
            where: { id: session.user.memberId },
            select: { nrp: true, memberNo: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Find all slips for this member (by NRP matching)
        const slips = await prisma.payrollSlip.findMany({
            where: {
                OR: [
                    { memberId: session.user.memberId },
                    { nrp: member.nrp || member.memberNo },
                ],
            },
            include: { period: true },
            orderBy: [{ period: { periodYear: "desc" } }, { period: { periodMonth: "desc" } }],
        });

        return NextResponse.json({
            data: slips.map(s => ({
                slipId: s.id,
                periodName: s.period.periodName,
                periodId: s.period.id,
                gajiBersih: Number(s.gajiBersih),
                totalPotKoperasi: Number(s.totalPotKoperasi),
                sisaGaji: Number(s.sisaGaji),
                terimaBersih: Number(s.terimaBersih),
                bisaDiambilATM: Number(s.bisaDiambilATM),
            })),
        });
    } catch (error: any) {
        console.error("GET /api/member-portal/payroll error:", error);
        return NextResponse.json({ message: "Gagal memuat data slip gaji" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Create portal page**

Create `src/app/portal/gaji/page.tsx` — "use client" page following the portal dashboard pattern:
- Uses `useAuth` to get logged-in user
- Fetches from `GET /api/member-portal/payroll`
- Shows list of available periods as cards/rows
- Click a period → navigate to `/portal/gaji/[slipId]` for the full slip view
- Minimal, mobile-friendly layout (anggota view on phone)

- [ ] **Step 3: Commit**

```bash
git add src/app/portal/gaji/ src/app/api/member-portal/payroll/
git commit -m "feat: add member portal payroll slip self-service page"
```

---

## Task 8: Integration & Polish

**Files:**
- Modify: `src/app/(protected)/master/import-data/page.tsx` (optional — add "gaji_slip" import type)
- Verify: Navigation, RBAC, mobile responsiveness

- [ ] **Step 1: Verify navigation works**

Log in as operator → sidebar should show "Gaji & Slip" under Laporan → click navigates to `/gaji`

- [ ] **Step 2: Test full import flow**

1. Go to `/gaji` → click "Import Gaji"
2. Upload `5. GAJI MEI 2026 POLRES.xls`
3. Preview should show parsed rows with correct mapping
4. Commit → verify redirect to `/gaji/[periodId]`
5. Verify all slips are in the detail table

- [ ] **Step 3: Test slip print**

1. From detail page, click "Lihat Slip" on a member
2. Verify AMPLOP-style layout renders correctly
3. Click "Cetak" → verify print dialog opens with correct formatting
4. Verify all 30+ deduction categories appear

- [ ] **Step 4: Test portal access**

1. Log in as anggota → navigate to `/portal/gaji`
2. Verify only own slips are visible
3. Verify slip detail renders and prints correctly on mobile

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "feat: payroll slip gaji — integration testing and polish"
```

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| PayrollPeriod model | Task 1 |
| PayrollSlip model with structured + JSON fields | Task 1 |
| Import Excel POT GAJI sheet | Task 2 |
| Dynamic header mapping | Task 2 |
| Member matching (NRP + name fallback) | Task 2 |
| Internal koperasi calculation (sisaGaji, sisaTunkin) | Task 2 |
| Period list API | Task 3 |
| Period detail API with slips | Task 3 |
| Single slip API | Task 3 |
| Period list UI page | Task 4 |
| Navigation menu item | Task 4 |
| Period detail with table | Task 5 |
| AMPLOP-style slip preview | Task 6 |
| Print CSS | Task 6 |
| Portal anggota self-service | Task 7 |
| Duplicate period prevention | Task 2 |
| Batch insert for large files | Task 2 |
