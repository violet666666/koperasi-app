# Import VS SP — Design Spec

> Feature: Dedicated import for monthly SP (Simpan Pinjam) loan updates from Excel
> Created: 2026-06-04 | Branch: railway-migration
> Status: Approved

---

## 1. Overview

Create a **new dedicated import feature** ("Import VS SP") that reads the monthly SP Excel file (e.g. `SP_0626JUNI.xlsx`) and updates existing loan data in the database. This is separate from the existing `import-update` feature to avoid format coupling — the Excel format may change month-to-month.

### Goals
- Update existing loans (sisa saldo, jumlah terbayar, schedule status)
- Create new loans + new members if data doesn't exist yet
- Create LoanPayment records for the detected month
- Provide preview before commit, selective import, and undo capability
- Auto-detect month/period from Excel headers

### Non-Goals
- Does NOT affect Kas/Jurnal/CashBankTransaction (pure SP ledger operation)
- Does NOT replace the existing `import-update` or `import-migrasi` features
- Does NOT import sheets other than user-selected sheet

---

## 2. Source Format — GAJI Sheet

### Column Mapping (hardcoded, 0-indexed)

| Col | Header | Field | Type | Notes |
|-----|--------|-------|------|-------|
| 0 | NO | rowNumber | number | Sequential row number |
| 1 | KODE SATKER | kodeSatker | string | Satker code (02, 06, 10, etc.) |
| 2 | KLASIFIKASI | klasifikasi | number | 1=Gaji, 2=BS, 3=Tunkin |
| 3 | NAMA | nama | string | Member name (leading space common) |
| 4 | PANGKAT | pangkat | string | Police rank (BRIPKA, AIPTU, etc.) |
| 5 | NRP | nrp | string | NRP or NIP (pegawai) |
| 6 | TGL PINJAM | tglPinjam | string | Loan date (various formats) |
| 7 | PINJAM | pinjam | number | Principal amount |
| 8 | SELAMA | selama | number | Tenor in months |
| 9 | JASA | jasa | number | Monthly interest |
| 10 | ANGSURAN | angsuran | number | Monthly principal installment |
| 11 | POT [BULAN] | potBulan | number | Payment for detected month |
| 12 | TOTAL [BULAN] | totalBulan | number | Total installment for month |
| 13 | JUMLAH S/D | jumlahSd | number | Cumulative total paid |
| 14 | SISA SALDO | sisaSaldo | number | Remaining balance |

### Header Structure (rows 0-11)
- Row 0-2: Institution name (KEPOLISIAN NEGARA...)
- Row 4-5: Title (PIUTANG SIMPAN PINJAM ANGGOTA, PRIMKOPPOL RESOR LUMAJANG)
- Row 6: Period (e.g. "PER 31 JUNI 2026")
- Row 9-11: Column headers (3-row merged headers)

### Data Rows
- Start: row 12
- End: last row with non-empty NAMA field
- Typical count: ~160 rows per GAJI sheet
- Summary row: "JUMLAH" row at bottom (skip this)

### Month Auto-Detection
1. Parse row 6: regex `/PER\s+\d+\s+(\w+)\s+(\d{4})/` → extract month name + year
2. Parse row 11 sub-header: `/POT\s+(\w+)/` → confirm month
3. Map month names: JAN=1, FEBRUARI/PEB=2, MARET/MRT=3, APRIL=4, MEI=5, JUNI=6, JULI=7, AGS=8, SEPT=9, OKT=10, NOP/NOV=11, DES=12

### Row Filtering Rules
- **Include**: NAMA is non-empty AND PINJAM > 0 AND NAMA does not start with summary keywords (JUMLAH, PERMINTAAN, GAGAL POT, DITERIMA, DIKEMBALIKAN, MENGEMBALIKAN)
- **Skip**: NAMA empty, PINJAM ≤ 0, or summary rows

### Edge Cases
1. `TOTAL_BULAN = 0` (gagal pot): Still update loan, but payment amount = 0 (skip LoanPayment creation)
2. `TGL_PINJAM` typos (e.g. "12 mei 226"): Fix with regex/fallback
3. `SISA_SALDO = 0` with note "LUNAS": Mark loan as `paid_off`
4. NRP uses NIP format (1976xxx...): Still match via NRP field
5. Klasifikasi 2 & 3 mixed in GAJI sheet: Include all, klasifikasi is informational only
6. Rows with missing JASA/SELAMA: Still import with 0 for missing values

---

## 3. Matching Logic

### Member Matching (3-tier, in priority order)

**Tier 1: NRP/NIP Exact Match**
- Search `member.nrp === nrpFromExcel` OR `member.memberNo === nrpFromExcel`
- Case-insensitive, trimmed

**Tier 2: Name Match (fallback)**
- Clean name: remove titles (S.H., S.T., S.SOS., S.I.K., S.PD., S.E., S.IP., M.H., M.SC., S.OR.), strip dots/special chars, uppercase, normalize whitespace
- Exact match: `cleanName(excel) === cleanName(db)`
- Fuzzy: contains match (both directions, min 3 chars)

**Tier 3: Auto-Create**
- Create new `Member` + `User` account
- Email: `{cleanNameLower}@koperasi.local`
- Password: NRP value or "123" if NRP empty
- Role: "admin"
- NRP: value from Excel or `NO-NRP-{random}`

### Loan Matching (3-strategy, after member found)

**Strategy 1: Exact Amount + Date Match**
- `memberId = matched.member.id`
- `principalAmount ≈ PINJAM` (tolerance ±1% for rounding)
- `disbursementDate` within ±30 days of `TGL_PINJAM`
- If multiple matches, pick most recent

**Strategy 2: Exact Amount Only**
- `memberId = matched.member.id`
- `principalAmount ≈ PINJAM`
- `status = "active"`
- Pick most recent by disbursementDate

**Strategy 3: No Matching Loan → Create New**
- Create full: LoanApplication (disbursed) + Loan + LoanSchedule + LoanPayment

### Preview Status Codes

| Status | Color | Condition |
|---|---|---|
| `UPDATE` | Green | Member + Loan both matched |
| `NEW_LOAN` | Yellow | Member matched, no matching loan |
| `NEW_MEMBER` | Blue | No member match |
| `SKIP_ZERO` | Gray | PINJAM ≤ 0 or saldo koreksi |
| `ERROR` | Red | Missing required fields, invalid data |

---

## 4. Update Logic

### For UPDATE status (existing loan matched)

**Loan record updates:**
```
principalPaid = JUMLAH_SD
principalOutstanding = SISA_SALDO
monthlyInstallment = ANGSURAN + JASA
interestPaid = jumlahSd * (jasa / (angsuran + jasa))  // proportional
interestOutstanding = max(0, totalInterest - interestPaid)
status = sisaSaldo <= 0 ? "paid_off" : "active"
```

**LoanPayment creation (only if POT_BULAN > 0):**
- Idempotency check: skip if payment already exists for this loan + this calendar month
- Amount = TOTAL_BULAN
- Principal portion = ANGSURAN
- Interest portion = JASA
- Payment date = 28th of detected month
- Notes = "Import VS SP [Month] [Year]"

**LoanSchedule updates:**
- Calculate `paidCount = round(JUMLAH_SD / (ANGSURAN + JASA))`
- Mark schedules 1..paidCount as "paid" with principalPaid + interestPaid
- Mark schedules paidCount+1..tenor as "pending"
- DO NOT delete and recreate schedules — only update status/amounts

### For NEW_LOAN / NEW_MEMBER status

Create:
1. `LoanApplication` — status: "disbursed", applicationNo: `SP-IMP/NNNN/PRIM/ROMAN/YEAR`
2. `Loan` — all fields from Excel, status: active (or paid_off if sisaSaldo ≤ 0)
3. `LoanSchedule` — one per tenor month, mark paid ones
4. `LoanPayment` — if potBulan > 0

---

## 5. Batch System & Undo

### ImportBatch Model (new Prisma model)

```prisma
model ImportBatch {
  id            String   @id @default(uuid())
  batchNo       String   @unique  // "VS-SP/0001/PRIM/JUN/2026"
  type          String             // "import_vs_sp"
  fileName      String             // "SP_0626JUNI.xlsx"
  sheetName     String             // "GAJI"
  period        String             // "JUNI 2026"
  totalRows     Int
  successCount  Int
  errorCount    Int
  loanIds       Json               // string[] of loan IDs
  paymentIds    Json               // string[] of payment IDs
  memberIds     Json               // string[] of NEW member IDs only
  preImportSnapshots Json           // { loanId: { principalPaid, ... } } for undo
  createdById   String
  createdBy     User    @relation(fields: [createdById], references: [id])
  createdAt     DateTime @default(now())
}
```

### Undo Operation
- Delete all `LoanPayment` records in `paymentIds`
- Revert `Loan` records in `loanIds` to pre-import state (requires snapshot)
- For NEW members in `memberIds`: delete their loans + member + user account
- For NEW loans (not new member): delete loan + schedules + payments

**Simplified Undo (Phase 1):**
- Store `preImportSnapshots: Json` in ImportBatch — for each updated loan, save `{ loanId, principalPaid, principalOutstanding, interestPaid, interestOutstanding, status }` before import
- On undo: delete LoanPayments from `paymentIds`, then restore Loan fields from snapshots
- For new members/loans: delete LoanSchedule → Loan → LoanApplication → Member → User (cascade)

---

## 6. API Specification

### Endpoint: `POST /api/loans/import-vs-sp`

**Request (multipart/form-data):**
| Field | Type | Required | Default |
|---|---|---|---|
| `file` | File (.xlsx/.xls) | Yes | — |
| `sheetName` | String | No | "GAJI" |
| `mode` | "preview" \| "commit" | Yes | — |
| `selectedRows` | JSON (int[]) | No (commit only) | All valid rows |

**Preview Response:**
```json
{
  "period": "JUNI 2026",
  "availableSheets": ["DATA AWAL", "REMON", "BS", "BHAYANGKARA", "Sheet1", "REKAP", "GAJI", "Sheet3"],
  "summary": {
    "total": 161,
    "update": 120,
    "newLoan": 25,
    "newMember": 10,
    "skipZero": 2,
    "error": 4
  },
  "rows": [
    {
      "rowIndex": 12,
      "status": "UPDATE",
      "memberMatch": "NRP",
      "memberName": "AAN NISMANTO",
      "nrp": "84051293",
      "pinjam": 27000000,
      "angsuran": 750000,
      "jasa": 270000,
      "potBulan": 1020000,
      "totalBulan": 1020000,
      "jumlahSd": 18750000,
      "sisaSaldo": 8250000,
      "loanNo": "SP-IMP/0001/PRIM/IV/2026",
      "paidCount": 25,
      "notes": null
    }
  ],
  "errors": [
    {
      "rowIndex": 42,
      "error": "NRP tidak ditemukan dan nama tidak match",
      "data": { "nama": "...", "nrp": "..." }
    }
  ]
}
```

**Commit Response:**
```json
{
  "batchId": "uuid-xxx",
  "batchNo": "VS-SP/0001/PRIM/JUN/2026",
  "imported": 155,
  "failed": 6,
  "createdMembers": 10,
  "createdLoans": 35,
  "updatedLoans": 120,
  "createdPayments": 150
}
```

### Endpoint: `GET /api/loans/import-vs-sp/batches`
List all VS-SP import batches with summary.

### Endpoint: `DELETE /api/loans/import-vs-sp/batches/[batchId]`
Undo an import batch.

---

## 7. UI Changes

### Location: `/master/import-data` (extend existing import page)

**New import type in dropdown:** `"Import VS SP (Per Bulan)"` → type `"vs_sp"`

**Additional UI elements (shown when vs_sp selected):**

1. **Sheet selector** — dropdown, populated after file upload, default "GAJI"
2. **Period badge** — auto-detected, e.g. "Periode: JUNI 2026"
3. **Summary cards** — 4 colored cards:
   - 🟢 UPDATE: N rows (existing data updated)
   - 🟡 NEW LOAN: N rows (new loans for existing members)
   - 🔵 NEW MEMBER: N rows (new members + loans)
   - 🔴 ERROR: N rows (cannot import)
4. **Preview table** with columns:
   - ✓ Checkbox (default: checked for valid rows)
   - Status badge (colored)
   - Match Method (NRP / Name / New)
   - Nama Anggota
   - NRP/NIP
   - Pinjaman (formatted Rp)
   - Potongan Bulan Ini (formatted Rp)
   - Total Terbayar (formatted Rp)
   - Sisa Saldo (formatted Rp)
   - Loan No (if matched)
   - Notes
5. **Import button** — "Import N Data Valid"
6. **Riwayat tab** — table of previous VS-SP batches with undo button

---

## 8. File Structure

```
src/app/api/loans/import-vs-sp/
  route.ts                    — POST handler (preview + commit)
  batches/route.ts            — GET list of batches
  batches/[batchId]/route.ts  — DELETE (undo batch)

src/app/(protected)/master/import-data/
  page.tsx                    — Extend with vs_sp type + sheet selector
```

**Shared utilities** (extracted from existing import for reuse):
- `cleanNameForMatch()` — already exists in import-update
- `parseLoanDate()` — date parsing from various formats
- `generateApplicationNo()` — sequential number generation

---

## 9. Constraints & Safety

1. **No Kas/Jurnal impact** — Does not create JournalEntry or CashBankTransaction
2. **Operator-only** — Only operator role can access this import
3. **Idempotent** — Re-importing same month won't create duplicate payments
4. **Max 5 min timeout** — `maxDuration = 300` for large files
5. **Batch size: 5 concurrent** — Process 5 rows at a time to avoid DB overload
6. **Format-locked** — Hardcoded column mapping for GAJI sheet format only
7. **Not replacing** existing import-update — both features coexist independently
