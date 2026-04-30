# Rekap Jasa Pinjaman Per Bulan — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a new page `/pinjaman/laporan-jasa` that shows monthly interest (jasa) and principal (pokok) income from loan repayments, with period filtering, Excel export, and PDF print.

**Architecture:** New API endpoint queries `LoanPayment` records grouped by month, summing `interestPortion` and `principalPortion`. Frontend page uses existing component patterns (PageHeader, Card, Table, exportToExcel/exportToPDF). Navigation updated to add menu item under Pinjaman section.

**Tech Stack:** Next.js App Router, Prisma, shadcn/ui, xlsx library (already installed), existing `export-utils.ts`

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/loans/reports/interest/route.ts` | CREATE | GET API — monthly jasa/pokok aggregation |
| `src/app/api/loans/reports/interest/export/route.ts` | CREATE | GET API — Excel export download |
| `src/app/(protected)/pinjaman/laporan-jasa/page.tsx` | CREATE | UI page — filters, cards, table, export |
| `src/lib/constants/navigation.ts` | MODIFY | Add "Laporan Jasa" menu item |

---

### Task 1: Create API Endpoint — GET /api/loans/reports/interest

**Files:**
- Create: `src/app/api/loans/reports/interest/route.ts`

- [ ] **Step 1: Create the route file with full implementation**

Create directory structure and file:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name;
  if (roleName !== "operator") {
    return NextResponse.json({ message: "Akses ditolak. Hanya operator." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthFrom = searchParams.get("monthFrom");
  const monthTo = searchParams.get("monthTo");

  const now = new Date();
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  const currentYM = `${nowWIB.getUTCFullYear()}-${String(nowWIB.getUTCMonth() + 1).padStart(2, "0")}`;

  const from = monthFrom || currentYM;
  const to = monthTo || currentYM;

  // Build date range: first day of monthFrom to last day of monthTo (WIB)
  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  const dateFrom = new Date(Date.UTC(fromYear, fromMonth - 1, 1) - WIB_OFFSET);
  const dateTo = new Date(Date.UTC(toYear, toMonth, 0, 23 - 7, 59, 59, 999));

  // Fetch all payments in range
  const payments = await prisma.loanPayment.findMany({
    where: {
      paymentDate: {
        gte: dateFrom,
        lte: dateTo,
      },
    },
    select: {
      paymentDate: true,
      interestPortion: true,
      principalPortion: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  // Group by month in JS (Prisma doesn't support DATE_TRUNC directly)
  const monthMap = new Map<string, { totalJasa: number; totalPokok: number; totalTransactions: number }>();

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  for (const p of payments) {
    const d = new Date(p.paymentDate.getTime() + WIB_OFFSET);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

    if (!monthMap.has(key)) {
      monthMap.set(key, { totalJasa: 0, totalPokok: 0, totalTransactions: 0 });
    }
    const entry = monthMap.get(key)!;
    entry.totalJasa += Number(p.interestPortion);
    entry.totalPokok += Number(p.principalPortion);
    entry.totalTransactions += 1;
  }

  // Sort by month ascending and build response
  const data = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals]) => {
      const [y, m] = month.split("-").map(Number);
      return {
        month,
        monthLabel: `${monthNames[m - 1]} ${y}`,
        totalJasa: totals.totalJasa,
        totalPokok: totals.totalPokok,
        totalTransactions: totals.totalTransactions,
      };
    });

  // Grand total
  const summary = {
    grandTotalJasa: data.reduce((sum, d) => sum + d.totalJasa, 0),
    grandTotalPokok: data.reduce((sum, d) => sum + d.totalPokok, 0),
    grandTotalTransactions: data.reduce((sum, d) => sum + d.totalTransactions, 0),
  };

  return NextResponse.json({ data, summary });
}
```

- [ ] **Step 2: Test the API endpoint**

Run: `npx next dev` then visit `http://localhost:3000/api/loans/reports/interest?monthFrom=2026-01&monthTo=2026-04`

Expected: JSON response with `data` array and `summary` object. Verify:
- Auth blocks non-operator (test with different role)
- Empty period returns `{ data: [], summary: { grandTotalJasa: 0, ... } }`
- Valid period returns grouped monthly totals

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/reports/interest/route.ts
git commit -m "feat: add loan interest monthly report API endpoint"
```

---

### Task 2: Create Excel Export Endpoint

**Files:**
- Create: `src/app/api/loans/reports/interest/export/route.ts`

- [ ] **Step 1: Create the export route file**

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name;
  if (roleName !== "operator") {
    return NextResponse.json({ message: "Akses ditolak. Hanya operator." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthFrom = searchParams.get("monthFrom");
  const monthTo = searchParams.get("monthTo");

  const now = new Date();
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  const currentYM = `${nowWIB.getUTCFullYear()}-${String(nowWIB.getUTCMonth() + 1).padStart(2, "0")}`;

  const from = monthFrom || currentYM;
  const to = monthTo || currentYM;

  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  const dateFrom = new Date(Date.UTC(fromYear, fromMonth - 1, 1) - WIB_OFFSET);
  const dateTo = new Date(Date.UTC(toYear, toMonth, 0, 23 - 7, 59, 59, 999));

  const payments = await prisma.loanPayment.findMany({
    where: {
      paymentDate: { gte: dateFrom, lte: dateTo },
    },
    select: {
      paymentDate: true,
      interestPortion: true,
      principalPortion: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const monthMap = new Map<string, { totalJasa: number; totalPokok: number; totalTransactions: number }>();

  for (const p of payments) {
    const d = new Date(p.paymentDate.getTime() + WIB_OFFSET);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { totalJasa: 0, totalPokok: 0, totalTransactions: 0 });
    }
    const entry = monthMap.get(key)!;
    entry.totalJasa += Number(p.interestPortion);
    entry.totalPokok += Number(p.principalPortion);
    entry.totalTransactions += 1;
  }

  const rows = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals], idx) => {
      const [y, m] = month.split("-").map(Number);
      return [idx + 1, `${monthNames[m - 1]} ${y}`, totals.totalJasa, totals.totalPokok, totals.totalTransactions];
    });

  const grandJasa = rows.reduce((s, r) => s + (r[2] as number), 0);
  const grandPokok = rows.reduce((s, r) => s + (r[3] as number), 0);
  const grandTrx = rows.reduce((s, r) => s + (r[4] as number), 0);

  rows.push(["", "GRAND TOTAL", grandJasa, grandPokok, grandTrx]);

  const wsData = [
    ["No", "Bulan", "Total Jasa (Rp)", "Total Pokok (Rp)", "Jumlah Transaksi"],
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Jasa");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const fileName = `Rekap_Jasa_Pinjaman_${from}_sd_${to}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
```

- [ ] **Step 2: Test export endpoint**

Visit `http://localhost:3000/api/loans/reports/interest/export?monthFrom=2026-01&monthTo=2026-04`

Expected: XLSX file download with correct data.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/loans/reports/interest/export/route.ts
git commit -m "feat: add loan interest report Excel export endpoint"
```

---

### Task 3: Create UI Page — /pinjaman/laporan-jasa

**Files:**
- Create: `src/app/(protected)/pinjaman/laporan-jasa/page.tsx`

- [ ] **Step 1: Create the page file**

```typescript
"use client";

import * as React from "react";
import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Printer, TrendingUp, CreditCard, FileText, RefreshCw } from "lucide-react";
import { formatCurrency } from "@/lib/constants";

interface MonthlyData {
  month: string;
  monthLabel: string;
  totalJasa: number;
  totalPokok: number;
  totalTransactions: number;
}

interface ReportSummary {
  grandTotalJasa: number;
  grandTotalPokok: number;
  grandTotalTransactions: number;
}

// Generate month options for last 24 months
function generateMonthOptions(): { value: string; label: string }[] {
  const months = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember",
  ];
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = `${months[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value: val, label });
  }
  return options;
}

export default function LaporanJasaPage() {
  const monthOptions = React.useMemo(generateMonthOptions, []);
  const currentMonth = monthOptions[0]?.value || "";

  const [monthFrom, setMonthFrom] = React.useState(currentMonth);
  const [monthTo, setMonthTo] = React.useState(currentMonth);
  const [data, setData] = React.useState<MonthlyData[]>([]);
  const [summary, setSummary] = React.useState<ReportSummary>({
    grandTotalJasa: 0,
    grandTotalPokok: 0,
    grandTotalTransactions: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);

  async function fetchData() {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ monthFrom, monthTo });
      const res = await fetch(`/api/loans/reports/interest?${params}`);
      if (!res.ok) throw new Error("Gagal memuat data");
      const json = await res.json();
      setData(json.data || []);
      setSummary(json.summary || { grandTotalJasa: 0, grandTotalPokok: 0, grandTotalTransactions: 0 });
    } catch (err) {
      console.error(err);
      setData([]);
    } finally {
      setIsLoading(false);
    }
  }

  React.useEffect(() => {
    fetchData();
  }, [monthFrom, monthTo]);

  function handleExportExcel() {
    const params = new URLSearchParams({ monthFrom, monthTo });
    window.open(`/api/loans/reports/interest/export?${params}`, "_blank");
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rekap Jasa Pinjaman Per Bulan"
        description="Laporan pendapatan jasa (bunga) dari pembayaran angsuran pinjaman anggota"
      />

      {/* Filters */}
      <div className="print:hidden flex flex-wrap items-end gap-4">
        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Dari Bulan</label>
          <Select value={monthFrom} onValueChange={setMonthFrom}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-muted-foreground">Sampai Bulan</label>
          <Select value={monthTo} onValueChange={setMonthTo}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {monthOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="icon" onClick={fetchData} title="Refresh">
          <RefreshCw className="h-4 w-4" />
        </Button>

        <div className="flex gap-2 ml-auto">
          <Button variant="outline" onClick={handleExportExcel}>
            <Download className="h-4 w-4 mr-2" />
            Export Excel
          </Button>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Cetak
          </Button>
        </div>
      </div>

      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-lg font-bold text-center">REKAP JASA PINJAMAN PER BULAN</h1>
        <p className="text-center text-sm">PRIMKOPPOL POLRES LUMAJANG</p>
        <p className="text-center text-sm">
          Periode: {monthOptions.find((m) => m.value === monthFrom)?.label} s/d{" "}
          {monthOptions.find((m) => m.value === monthTo)?.label}
        </p>
        <p className="text-center text-sm">Dicetak: {new Date().toLocaleDateString("id-ID")}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Jasa</CardTitle>
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-emerald-600">
                {formatCurrency(summary.grandTotalJasa)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Pokok</CardTitle>
            <CreditCard className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(summary.grandTotalPokok)}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Jumlah Transaksi</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <p className="text-2xl font-bold">{summary.grandTotalTransactions}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : data.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            Belum ada pembayaran angsuran di periode ini.
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead>Bulan</TableHead>
              <TableHead className="text-right">Jasa Terbayar</TableHead>
              <TableHead className="text-right">Pokok Terbayar</TableHead>
              <TableHead className="text-right">Jumlah Trx</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow key={row.month}>
                <TableCell>{idx + 1}</TableCell>
                <TableCell className="font-medium">{row.monthLabel}</TableCell>
                <TableCell className="text-right text-emerald-600 font-medium">
                  {formatCurrency(row.totalJasa)}
                </TableCell>
                <TableCell className="text-right text-blue-600 font-medium">
                  {formatCurrency(row.totalPokok)}
                </TableCell>
                <TableCell className="text-right">{row.totalTransactions}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow className="font-bold">
              <TableCell colSpan={2}>TOTAL</TableCell>
              <TableCell className="text-right text-emerald-600">
                {formatCurrency(summary.grandTotalJasa)}
              </TableCell>
              <TableCell className="text-right text-blue-600">
                {formatCurrency(summary.grandTotalPokok)}
              </TableCell>
              <TableCell className="text-right">
                {summary.grandTotalTransactions}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Test the page**

Navigate to `http://localhost:3000/pinjaman/laporan-jasa`

Expected:
- Page loads with filter bar showing month selectors
- Summary cards show totals
- Table shows monthly breakdown
- Export Excel button triggers download
- Print button opens browser print dialog
- Non-operator users see empty or are redirected

- [ ] **Step 3: Commit**

```bash
git add src/app/\(protected\)/pinjaman/laporan-jasa/page.tsx
git commit -m "feat: add loan interest monthly report page UI"
```

---

### Task 4: Add Navigation Menu Item

**Files:**
- Modify: `src/lib/constants/navigation.ts` (lines ~90-99, Pinjaman section)

- [ ] **Step 1: Add menu item to mainNavigation**

Find the Pinjaman children array in `mainNavigation` (around line 90-99):

```typescript
{
    title: "Pinjaman", href: "/pinjaman", icon: CreditCard,
    permission: "manage_pinjaman",
    children: [
        { title: "Pengajuan", href: "/pinjaman/pengajuan" },
        { title: "Daftar Pinjaman", href: "/pinjaman" },
        { title: "Angsuran", href: "/pinjaman/angsuran" },
        { title: "Jadwal Angsuran", href: "/pinjaman/jadwal" },
        { title: "Laporan Jasa", href: "/pinjaman/laporan-jasa" },  // ADD THIS LINE
    ],
},
```

Also add the `FileText` icon import if not already imported (it's likely already there since Laporan section uses it).

- [ ] **Step 2: Verify navigation appears**

Login as operator, check sidebar shows "Laporan Jasa" under Pinjaman menu. Click it — should navigate to the report page.

- [ ] **Step 3: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "feat: add Laporan Jasa menu item to Pinjaman navigation"
```

---

### Task 5: Build Verification & Final Commit

- [ ] **Step 1: Run build to verify no errors**

```bash
npx next build
```

Expected: Build succeeds with no TypeScript or compilation errors. Verify `/pinjaman/laporan-jasa` appears in the route list.

- [ ] **Step 2: Squash or leave individual commits**

If desired, the 4 commits from Tasks 1-4 can be squashed into one. Otherwise they can remain as-is for traceability.

- [ ] **Step 3: Update spec status**

Update `docs/superpowers/specs/2026-04-30-rekap-jasa-pinjaman-design.md` header: change `Status: Approved` to `Status: Implemented`
