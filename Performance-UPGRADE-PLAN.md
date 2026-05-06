# Performance UPGRADE Plan — Koperasi App

> Audit date: 07 Mei 2026
> Infra: NeonDB Pro (usage-based CU) + Vercel Hobby (free)
> Framework: Next.js 16.1.4 + Prisma 6.19 + React 19

---

## Executive Summary

**Apakah perlu ganti database?** **TIDAK.** NeonDB PostgreSQL sudah tepat untuk use case ini. Masalah performance bukan di database engine, melainkan di **cara aplikasi menggunakannya** — missing indexes, JS-side aggregation yang seharusnya SQL-side, dan tidak adanya connection pooling untuk serverless.

**Apakah perlu upgrade Vercel?** **Untuk saat ini TIDAK TERDEPAN.** Vercel Hobby memiliki limit 10s timeout per serverless function dan 100GB bandwidth. Jika setelah optimasi di bawah masih lambat, barulah pertimbangkan Pro ($20/bulan).

**Target:** Reduce p95 API response time dari ~2-5 detik menjadi <500ms untuk halaman utama, dan <2 detik untuk report berat.

---

## Infra Current State

| Komponen | Saat Ini | Status |
|----------|----------|--------|
| Database | NeonDB Pro (usage-based CU) | OK — cukup untuk skala ini |
| Hosting | Vercel Hobby (free) | OK setelah optimasi |
| Connection | PrismaClient via TCP (no pooling) | **BURUK** — cold start latency |
| Caching | Zero (25+ routes force-dynamic) | **BURUK** — DB hit setiap request |
| Indexes | ~30 tables, beberapa missing | **PERLU PATCH** |
| Bundle | ~700KB+ first load JS | **PERLU OPTIMASI** |

---

## FASE 1: Database Optimization (Zero Cost, High Impact)

### 1.1 — Install Neon Serverless Adapter

**Masalah:** Setiap Vercel cold start membuka koneksi TCP baru ke Neon. Ini memakan waktu ~300-500ms. Neon menyediakan HTTP-based driver yang jauh lebih cepat untuk serverless.

**Solusi:**
```bash
npm install @prisma/adapter-neon @neondatabase/serverless
```

**Update `src/lib/prisma.ts`:**
```typescript
import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { neon } from "@neondatabase/serverless";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

function createPrismaClient() {
    const url = process.env.DATABASE_URL!;
    // Gunakan HTTP adapter untuk serverless (Vercel)
    if (process.env.VERCEL) {
        const sql = neon(url);
        const adapter = new PrismaNeonHTTP(sql);
        return new PrismaClient({ adapter, log: ["error"] });
    }
    // Development tetap pakai TCP
    return new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"] : ["error"],
        datasources: { db: { url } },
    });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}
```

**Update `.env` (Neon pooler):**
```
DATABASE_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

**Note:** Neon HTTP adapter saat ini memiliki beberapa batasan — tidak mendukung interactive transactions. Untuk route yang pakai `$transaction` (pinjaman, simpanan, kas-bank), gunakan TCP fallback. Pendekatan terbaik: dua PrismaClient — HTTP untuk reads, TCP untuk writes.

**Perbaikan estimasi:** -200ms hingga -400ms per cold start, mengurangi CU consumption.

### 1.2 — Tambahkan Missing Database Indexes

**File:** `prisma/schema.prisma`

```prisma
// === CRITICAL: LoanSchedule (ribuan rows, di-query terus) ===
model LoanSchedule {
  // ... existing fields ...
  @@index([loanId])         // FK tanpa index — seq scan setiap load loan detail
  @@index([status])         // Filter: pending/partial/overdue di faktur-potongan
  @@index([dueDate])        // Date range filter di payment reports
}

// === CRITICAL: CashBankTransaction (grows unbounded) ===
model CashBankTransaction {
  // ... existing fields ...
  @@index([transactionDate])   // Arus kas report filter by date range
  @@index([category])          // Filter by category
}

// === HIGH: StoreProduct (query setiap POS load) ===
model StoreProduct {
  // ... existing fields ...
  @@index([unitType])               // WHERE unitType = 'toko' di setiap load
  @@index([unitType, isActive])     // Composite: WHERE unitType AND isActive
  @@index([category])               // Category filter
}

// === HIGH: LoanPayment ===
model LoanPayment {
  // ... existing fields ...
  @@index([memberId])    // Mobile transaction history by member
}

// === MEDIUM: CashBankAccount ===
model CashBankAccount {
  // ... existing fields ...
  @@index([isActive])    // Dashboard stats: WHERE isActive = true
  @@index([unitType])    // Filter by unit
}

// === MEDIUM: CashierShift ===
model CashierShift {
  // ... existing fields ...
  @@index([unitType])    // Shift management
  @@index([status])      // WHERE status = 'open'
  @@index([userId])      // FK lookup
}

// === MEDIUM: Receipt ===
model Receipt {
  // ... existing fields ...
  @@index([type])        // Filter by receipt type
}

// === LOW: lainnya ===
model FiscalPeriod {
  @@index([status])
}
model Account {
  @@index([type])
}
model Announcement {
  @@index([status])
  @@index([category])
}
```

**Apply:**
```bash
npx prisma db push
```

**Perbaikan estimasi:** -50% hingga -80% query time untuk tabel yang terdampak.

### 1.3 — Ganti JS Aggregation → SQL Aggregation

**Lima route yang memuat semua data ke memori lalu agregasi di JS:**

| Route | Masalah | Solusi |
|-------|---------|--------|
| `reports/laba-rugi` | Load semua journal lines → reduce di JS | `$queryRaw` dengan `GROUP BY` |
| `reports/neraca` | Sama seperti laba-rugi | `$queryRaw` dengan `GROUP BY` |
| `reports/arus-kas` | Load semua cash_bank_transactions | `$queryRaw` dengan `SUM` |
| `member-portal/summary` | Load semua members untuk SHU | `prisma.member.aggregate({ _sum })` |
| `reports/piutang-gabungan` | Load semua members + loans + sales | SQL window functions atau CTE |

**Contoh perbaikan laba-rugi:**

Sebelum (JS aggregation — load ratusan journal lines):
```typescript
const journalLines = await prisma.journalLine.findMany({
    where: { journal: { transactionDate: { gte: startDate, lte: endDate }, isPosted: true },
             account: { type: { in: ["income", "expense"] } } },
    include: { account: true },
});
// ... reduce in JS
```

Sesudah (SQL aggregation — satu query):
```typescript
const results = await prisma.$queryRaw`
    SELECT a.id, a.code, a.name, a.type, a.normal_balance,
           SUM(CASE WHEN a.normal_balance = 'credit'
                THEN jl.credit - jl.debit ELSE jl.debit - jl.credit END) as amount
    FROM journal_lines jl
    JOIN journals j ON jl.journal_id = j.id
    JOIN accounts a ON jl.account_id = a.id
    WHERE j.transaction_date BETWEEN ${startDate} AND ${endDate}
      AND j.is_posted = true AND a.type IN ('income', 'expense')
    GROUP BY a.id, a.code, a.name, a.type, a.normal_balance
    ORDER BY a.code
`;
```

**Perbaikan estimasi:** -70% memory usage, -60% response time untuk reports.

---

## FASE 2: API Route Optimization (Zero Cost, Medium Impact)

### 2.1 — Fix N+1 Queries

| Route | Masalah | Fix |
|-------|---------|-----|
| `toko/shifts` (line 75) | `Promise.all(shifts.map(async ...))` — N queries | Satu query dengan `include` |
| `reports/faktur-potongan` | Load semua members → filter di JS | DB-level `WHERE` + pagination |
| `loans/import-update` | `findMany` members 3x | Cache hasil pertama |

### 2.2 — Pagination di Report Routes

Report yang memuat semua data tanpa limit:
- `reports/loans-recap` — perlu server-side pagination
- `reports/piutang-gabungan` — pagination di SQL, bukan post-hoc di JS
- `reports/faktur-potongan` — sama

**Pendekatan:** Untuk report yang tetap perlu "semua data" (export), gunakan cursor-based pagination:
```typescript
const BATCH = 500;
let cursor: string | undefined;
let allResults: any[] = [];

do {
    const batch = await prisma.member.findMany({
        take: BATCH,
        skip: cursor ? 1 : 0,
        cursor: cursor ? { id: cursor } : undefined,
        where: { status: "active", deletedAt: null },
    });
    allResults.push(...batch);
    cursor = batch.length === BATCH ? batch[batch.length - 1].id : undefined;
} while (cursor);
```

### 2.3 — In-Memory Cache untuk Data yang Jarang Berubah

Dashboard stats sudah punya 60s TTL cache. Perluas ke data lain:

```typescript
// src/lib/cache.ts
const cache = new Map<string, { data: unknown; expiry: number }>();

export function getCached<T>(key: string, ttlMs: number, fetcher: () => Promise<T>): Promise<T> {
    const entry = cache.get(key);
    if (entry && Date.now() < entry.expiry) return Promise.resolve(entry.data as T);

    return fetcher().then(data => {
        cache.set(key, { data, expiry: Date.now() + ttlMs });
        return data;
    });
}
```

**Kandidat cache:**
- `accounts` (chart of accounts) — TTL 5 menit, berubah sangat jarang
- `members?status=active&select=id,nrp,name` — TTL 30 detik untuk dropdown
- `products?unitType=toko` — TTL 30 detik untuk POS product list
- `fiscal-period?status=open` — TTL 1 menit

**PENTING:** Invalidate cache saat ada write operation (create/update/delete).

---

## FASE 3: Client-Side Performance (Zero Cost, Medium Impact)

### 3.1 — Dynamic Import untuk Library Berat

**jsPDF di Kartu Anggota (~300KB):**

Sekarang (load saat page mount):
```typescript
import jsPDF from "jspdf";
```

Sesudah (load hanya saat klik print):
```typescript
const handlePrint = async () => {
    const { default: jsPDF } = await import("jspdf");
    // ... generate PDF
};
```

**recharts di charts (~200KB):**

Sudah di-handle oleh `optimizePackageImports` di `next.config.ts`. Namun jika chart hanya tampil di halaman tertentu, bisa lebih optimal dengan `next/dynamic`:
```typescript
const CashFlowChart = dynamic(() => import("@/components/patterns/cash-flow-chart"), {
    ssr: false,
    loading: () => <Skeleton className="h-[300px]" />,
});
```

### 3.2 — Search Debounce (SUDAH DIIMPLEMENTASI)

Debounce 400ms untuk pencarian yang trigger API call — sudah diterapkan di:
- `persediaan/page.tsx` (custom search)
- `data-table.tsx` (reusable component, ketika `manualFiltering=true`)

### 3.3 — Prefetch Routes

Tambahkan prefetch di sidebar navigation untuk halaman yang sering dikunjungi:
```tsx
<Link href="/toko/persediaan" prefetch={true}>...</Link>
```

Next.js sudah prefetch visible links by default di viewport, tapi bisa diperkuat di sidebar.

---

## FASE 4: Infrastructure Tuning (Low Cost)

### 4.1 — Vercel Configuration

Buat `vercel.json`:
```json
{
  "functions": {
    "src/app/api/**/*.ts": {
      "memory": 1024,
      "maxDuration": 60
    },
    "src/app/api/payroll/import/route.ts": {
      "memory": 3008,
      "maxDuration": 300
    },
    "src/app/api/loans/import-update/route.ts": {
      "memory": 3008,
      "maxDuration": 300
    },
    "src/app/api/members/import/route.ts": {
      "memory": 3008,
      "maxDuration": 300
    }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "s-maxage=10, stale-while-revalidate=59" }
      ]
    },
    {
      "source": "/(.*)\\.(js|css|woff2|png|jpg|svg|ico)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

**Note:** `maxDuration` di atas 10s dan `memory` di atas 1024MB memerlukan Vercel Pro. Jika tetap di Hobby, import routes perlu di-refactor menjadi chunked processing.

### 4.2 — NeonDB Connection Pooling

Pastikan `DATABASE_URL` menggunakan Neon's pooled connection:
```
# POOLING (untuk runtime di Vercel)
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/dbname?sslmode=require"

# DIRECT (untuk prisma migrate / db push)
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/dbname?sslmode=require"
```

Perhatikan `-pooler` pada hostname dan port 6543 (bukan 5432). Ini membuat Neon handle connection pooling di sisi server, sehingga setiap Vercel function tidak perlu membuka koneksi baru.

### 4.3 — NeonDB Autoscaling

NeonDB Pro sudah autoscale by default. Pastikan:
- Compute size minimal `0.25 CU` (sudah default)
- Auto-suspend dimatikan atau set ke `5 menit` agar cold start DB minimal
- Jika budget memungkinkan, set minimum compute ke `0.5 CU` untuk performance lebih stabil

---

## FASE 5: Vercel Hobby vs Pro — Kapan Upgrade?

### Vercel Hobby Limitations yang Mempengaruhi Performance:

| Limit | Hobby | Pro | Dampak |
|-------|-------|-----|--------|
| Serverless timeout | 10s | 60s | Import routes (>10s) akan timeout |
| Function memory | 1024MB | 3008MB | Import berat bisa OOM |
| Bandwidth | 100GB | 1TB | Cukup untuk <10 user concurrent |
| Concurrent builds | 1 | 3 | Build queue saat ada banyak deploy |

### Rekomendasi:

**Saat ini (Mei 2026):** Tetap di Hobby. Fokus optimasi di Fase 1-3 dulu. Semua perbaikan di atas **zero cost**.

**Upgrade ke Pro ($20/bulan) ketika:**
- Import payroll/loan sering timeout (>10s)
- Ada >5 concurrent users yang complain lambat
- Butuh serverless memory >1GB
- Butuh analytics/monitoring bawaan

### Alternatif Vercel Pro: Self-hosting VPS

Jika ingin control penuh dengan budget serupa:
- **VPS Hetzner/DigitalOcean** (~$5-10/bulan) + Docker
- Next.js `output: "standalone"` + PM2/Nginx
- Prisma connection pooling built-in (bukan serverless)
- Unlimited timeout, memory sesuai VPS spec
- Trade-off: perlu manage sendiri SSL, backup, monitoring

---

## Prioritas Implementasi

| # | Task | Fase | Effort | Impact | Priority |
|---|------|------|--------|--------|----------|
| 1 | Tambah database indexes | 1.2 | 1 jam | HIGH | P0 |
| 2 | Verifikasi Neon pooler URL | 4.2 | 15 menit | HIGH | P0 |
| 3 | Fix laba-rugi SQL aggregation | 1.3 | 2 jam | HIGH | P0 |
| 4 | Fix arus-kas SQL aggregation | 1.3 | 2 jam | MEDIUM | P1 |
| 5 | Fix neraca SQL aggregation | 1.3 | 2 jam | MEDIUM | P1 |
| 6 | Fix member-portal/summary SHU calc | 1.3 | 3 jam | HIGH | P0 |
| 7 | Fix piutang-gabungan N+1 | 2.1 | 3 jam | MEDIUM | P1 |
| 8 | Dynamic import jsPDF | 3.1 | 30 menit | LOW | P2 |
| 9 | Add in-memory cache layer | 2.3 | 3 jam | MEDIUM | P1 |
| 10 | Install Neon HTTP adapter | 1.1 | 2 jam | HIGH | P0* |
| 11 | Buat vercel.json | 4.1 | 30 menit | LOW | P2 |
| 12 | Prefetch sidebar routes | 3.3 | 30 menit | LOW | P2 |

*P0 jika banyak cold start; bisa ditunda jika traffic sudah stabil.

---

## Estimasi Hasil Akhir

| Metrik | Sebelum | Sesudah Fase 1-2 | Sesudah Semua |
|--------|---------|-------------------|---------------|
| Dashboard load | ~3s | ~1s | ~500ms |
| POS product load | ~2s | ~800ms | ~500ms |
| Report laba-rugi | ~5s | ~1.5s | ~1s |
| Search debounce | Trigger/key | 400ms delay | 400ms delay |
| Cold start API | ~500ms | ~200ms | ~100ms |
| DB connection | TCP per function | Pooler | HTTP adapter |

**Total estimasi effort:** 15-20 jam kerja untuk semua fase.
**Cost tambahan:** $0 (semua optimasi di atas tanpa biaya tambahan di infra saat ini).

---

## Kesimpulan

1. **TIDAK perlu ganti database.** NeonDB Pro sudah cukup. Yang perlu diperbaiki adalah cara aplikasi query ke database (indexes, SQL aggregation, connection pooling).

2. **TIDAK perlu upgrade Vercel dulu.** Semua optimasi di atas bisa dilakukan di Hobby plan. Upgrade ke Pro hanya perlu ketika import routes timeout (>10s limit).

3. **Quick win terbesar:** Tambah database indexes (1 jam kerja) — ini langsung mengurangi query time 50-80% tanpa perubahan kode aplikasi.

4. **Second quick win:** Verifikasi Neon pooler URL sudah benar di `.env` production (15 menit).

5. **Long-term win:** Ganti JS aggregation ke SQL di report routes. Ini mengurangi memory usage dan response time secara signifikan.
