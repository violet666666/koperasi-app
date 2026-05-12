# Stock Tracking (Deteksi Selisih Stok) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stock discrepancy detection tool for admin toko at `/toko/stock-tracking` that compares physical stock counts against system stock, flags suspicious products where missing inventory exceeds recorded sales.

**Architecture:** Single-page app with 3-step wizard flow (Setup → Input → Results). Two API endpoints: one to fetch products by scope, one to analyze discrepancies with suspicious detection. No new Prisma models needed — all data comes from existing `StoreProduct`, `StoreSaleItem` tables. On-the-fly only, no DB persistence.

**Tech Stack:** Next.js App Router, Prisma ORM, shadcn/ui + @tanstack/react-table, SheetJS (xlsx) for Excel export, next-auth for auth.

**Spec:** `docs/superpowers/specs/2026-05-13-stock-tracking-design.md`

---

## File Structure

| File | Action | Responsibility |
|---|---|---|
| `src/app/api/toko/stock-tracking/products/route.ts` | CREATE | GET endpoint — fetch products by scope (all/category/specific) + system stock per location |
| `src/app/api/toko/stock-tracking/compare/route.ts` | CREATE | POST endpoint — analyze discrepancies + suspicious detection + Excel export |
| `src/app/(protected)/toko/stock-tracking/page.tsx` | CREATE | Stock tracking UI — 3-step wizard (setup, input, results) |
| `src/lib/constants/navigation.ts` | MODIFY | Add "Stock Tracking" menu item to `adminTokoNavigation` and `mainNavigation` Toko section |
| `src/app/(protected)/toko/layout.tsx` | MODIFY | No change needed — admin/operator bypass the lock screen; kasir access hidden by nav + page-level role check |

---

## Task 1: Products API Endpoint

**Files:**
- Create: `src/app/api/toko/stock-tracking/products/route.ts`

- [ ] **Step 1: Create the API route file**

Create directory and file:

```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/stock-tracking/products
// Fetch products by scope for stock tracking/opname
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as { name: string })?.name;

        if (!["admin", "operator"].includes(userRole)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const unitType = (session.user.unitType as string) || "toko";
        const { searchParams } = new URL(request.url);
        const scope = searchParams.get("scope") || "all"; // all | category | specific
        const location = searchParams.get("location") || "toko"; // toko | gudang
        const categories = searchParams.get("categories")?.split(",").filter(Boolean) || [];
        const productIds = searchParams.get("productIds")?.split(",").filter(Boolean) || [];

        // Build where clause
        const where: any = {
            unitType,
            isActive: true,
            deletedAt: null,
            isService: false,
        };

        if (scope === "category" && categories.length > 0) {
            where.category = { in: categories };
        } else if (scope === "specific" && productIds.length > 0) {
            where.id = { in: productIds };
        }

        const products = await prisma.storeProduct.findMany({
            where,
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                stockGdg: true,
                stockToko: true,
                costPrice: true,
                sellPrice: true,
            },
            orderBy: { name: "asc" },
        });

        const stockField = location === "gudang" ? "stockGdg" : "stockToko";

        const result = products.map((p) => ({
            id: p.id,
            name: p.name,
            sku: p.sku || "",
            category: p.category || "",
            unit: p.unit || "pcs",
            stockSystem: stockField === "gudang" ? p.stockGdg : p.stockToko,
            costPrice: Number(p.costPrice) || 0,
            sellPrice: Number(p.sellPrice) || 0,
        }));

        return NextResponse.json({ products: result });
    } catch (error) {
        console.error("[stock-tracking/products] Error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data produk" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run: `npx tsc --noEmit src/app/api/toko/stock-tracking/products/route.ts 2>&1 | head -20`

Expected: No errors (or only import path issues that resolve at build time). Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/toko/stock-tracking/products/route.ts
git commit -m "feat: add stock tracking products API endpoint"
```

---

## Task 2: Compare/Analyze API Endpoint

**Files:**
- Create: `src/app/api/toko/stock-tracking/compare/route.ts`

- [ ] **Step 1: Create the compare endpoint**

```ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface CompareItem {
    productId: string;
    physicalStock: number;
}

// POST /api/toko/stock-tracking/compare
// Analyze stock discrepancies and flag suspicious items
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole = typeof session.user.role === "string"
            ? session.user.role
            : (session.user.role as { name: string })?.name;

        if (!["admin", "operator"].includes(userRole)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { items, location, dateFrom, dateTo } = body as {
            items: CompareItem[];
            location: string;
            dateFrom?: string;
            dateTo?: string;
        };

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Data items kosong" }, { status: 400 });
        }

        const productIds = items.map((item) => item.productId);

        // Fetch products with system stock
        const products = await prisma.storeProduct.findMany({
            where: { id: { in: productIds } },
            select: {
                id: true,
                name: true,
                sku: true,
                category: true,
                unit: true,
                stockGdg: true,
                stockToko: true,
                costPrice: true,
                sellPrice: true,
            },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));
        const stockField = location === "gudang" ? "stockGdg" : "stockToko";

        // Build date range for suspicious detection (default: 7 days back)
        const toDate = dateTo ? new Date(dateTo) : new Date();
        const fromDate = dateFrom ? new Date(dateFrom) : new Date(toDate);
        if (!dateFrom) {
            fromDate.setDate(fromDate.getDate() - 7);
        }
        // Set end of day for toDate
        toDate.setHours(23, 59, 59, 999);
        fromDate.setHours(0, 0, 0, 0);

        // Fetch sold quantities for all relevant products in the date range
        // We need to filter non-voided sales
        const saleItems = await prisma.storeSaleItem.findMany({
            where: {
                productId: { in: productIds },
                sale: {
                    createdAt: { gte: fromDate, lte: toDate },
                    unitType: "toko",
                },
            },
            select: {
                productId: true,
                quantity: true,
                sale: {
                    select: {
                        metadata: true,
                    },
                },
            },
        });

        // Aggregate sold quantities per product (excluding voided)
        const soldByProduct = new Map<string, number>();
        for (const item of saleItems) {
            const meta = item.sale?.metadata as Record<string, unknown> | null;
            if (meta?.isVoided === true) continue;
            const current = soldByProduct.get(item.productId) || 0;
            soldByProduct.set(item.productId, current + item.quantity);
        }

        // Also fetch stock movements (stock_out/writeoff) in the period for context
        const movements = await prisma.storeStockMovement.findMany({
            where: {
                productId: { in: productIds },
                type: "out",
                status: "active",
                createdAt: { gte: fromDate, lte: toDate },
            },
            select: {
                productId: true,
                quantity: true,
                reason: true,
            },
        });

        const outByProduct = new Map<string, number>();
        for (const m of movements) {
            if (m.reason === "sale") continue; // sales already counted via saleItems
            const current = outByProduct.get(m.productId) || 0;
            outByProduct.set(m.productId, current + m.quantity);
        }

        // Build results
        const results = items.map((item) => {
            const product = productMap.get(item.productId);
            if (!product) return null;

            const stockSystem = stockField === "gudang" ? product.stockGdg : product.stockToko;
            const difference = item.physicalStock - stockSystem;
            const costPrice = Number(product.costPrice) || 0;
            const estimatedLoss = difference < 0 ? Math.abs(difference) * costPrice : 0;
            const totalSold = soldByProduct.get(item.productId) || 0;
            const totalOut = outByProduct.get(item.productId) || 0;

            // Suspicious: physical < system AND difference magnitude exceeds (sold + manual_out)
            // i.e., there's unaccounted loss
            const accountedFor = totalSold + totalOut;
            const isSuspicious = difference < 0 && Math.abs(difference) > accountedFor;
            const unaccounted = isSuspicious ? Math.abs(difference) - accountedFor : 0;

            let status: "sesuai" | "kurang" | "lebih" = "sesuai";
            if (difference < 0) status = "kurang";
            else if (difference > 0) status = "lebih";

            const suspiciousNote = isSuspicious
                ? `Selisih: ${difference} unit, Terjual (${Math.round((toDate.getTime() - fromDate.getTime()) / 86400000)} hari): ${totalSold}, Keluar lain: ${totalOut}, Potensi hilang tanpa transaksi: ${unaccounted} unit`
                : null;

            return {
                productId: product.id,
                name: product.name,
                sku: product.sku || "",
                category: product.category || "",
                unit: product.unit || "pcs",
                stockSystem,
                stockPhysical: item.physicalStock,
                difference,
                costPrice,
                estimatedLoss,
                status,
                suspicious: isSuspicious,
                totalSold,
                totalOut,
                unaccounted,
                suspiciousNote,
            };
        }).filter(Boolean);

        // Summary
        const totalChecked = results.length;
        const totalMatch = results.filter((r) => r!.status === "sesuai").length;
        const totalDiscrepancy = results.filter((r) => r!.status !== "sesuai").length;
        const totalUnitsMissing = results
            .filter((r) => r!.difference < 0)
            .reduce((sum, r) => sum + Math.abs(r!.difference), 0);
        const totalUnitsExtra = results
            .filter((r) => r!.difference > 0)
            .reduce((sum, r) => sum + r!.difference, 0);
        const estimatedLoss = results.reduce((sum, r) => sum + r!.estimatedLoss, 0);
        const suspiciousCount = results.filter((r) => r!.suspicious).length;

        return NextResponse.json({
            results,
            summary: {
                totalChecked,
                totalMatch,
                totalDiscrepancy,
                totalUnitsMissing,
                totalUnitsExtra,
                estimatedLoss,
                suspiciousCount,
                dateFrom: fromDate.toISOString(),
                dateTo: toDate.toISOString(),
            },
        });
    } catch (error) {
        console.error("[stock-tracking/compare] Error:", error);
        return NextResponse.json(
            { message: "Gagal menganalisis data" },
            { status: 500 }
        );
    }
}
```

- [ ] **Step 2: Verify the endpoint compiles**

Run: `npx tsc --noEmit src/app/api/toko/stock-tracking/compare/route.ts 2>&1 | head -20`

Expected: No errors. Fix any type errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/toko/stock-tracking/compare/route.ts
git commit -m "feat: add stock tracking compare/analyze API endpoint with suspicious detection"
```

---

## Task 3: Navigation — Add "Stock Tracking" Menu

**Files:**
- Modify: `src/lib/constants/navigation.ts` (lines 329-397 for adminTokoNavigation, lines 195-211 for mainNavigation)

- [ ] **Step 1: Add `SearchCheck` icon import**

At the top of `src/lib/constants/navigation.ts`, in the import block from `lucide-react` (around line 47), add `SearchCheck` to the import list:

```ts
// Add SearchCheck to existing import
import {
    // ... existing imports ...
    Banknote,
    SearchCheck,  // <-- add this
} from "lucide-react";
```

- [ ] **Step 2: Add menu item to `adminTokoNavigation`**

In `adminTokoNavigation`, inside the `"TOKO & PRODUK"` group (after "Persediaan & Stok" entry, around line 358), add:

```ts
{
    title: "Stock Tracking",
    href: "/toko/stock-tracking",
    icon: SearchCheck,
    permission: "manage_toko",
    roles: ["admin", "operator"],
},
```

- [ ] **Step 3: Add menu item to `mainNavigation` Toko section**

In `mainNavigation`, inside the `"Toko PRIMKOPPOL"` children array (around line 207, after "Persediaan" entry), add:

```ts
{ title: "Stock Tracking", href: "/toko/stock-tracking" },
```

- [ ] **Step 4: Verify build compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`

Expected: No errors related to navigation.

- [ ] **Step 5: Commit**

```bash
git add src/lib/constants/navigation.ts
git commit -m "feat: add Stock Tracking navigation menu for admin toko"
```

---

## Task 4: Stock Tracking UI Page — Setup & Input Steps

**Files:**
- Create: `src/app/(protected)/toko/stock-tracking/page.tsx`

This is the largest task. The page implements a 3-step wizard: Setup → Input Stok Fisik → Hasil Analisis.

- [ ] **Step 1: Create the page file with full implementation**

```tsx
"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
    SearchCheck,
    ArrowLeft,
    ArrowRight,
    Download,
    FileSpreadsheet,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronUp,
    Package,
} from "lucide-react";

import { PageHeader } from "@/components/patterns/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { exportToExcel, type ExportColumn } from "@/lib/export-utils";
import { cn } from "@/lib/utils";

// Types
interface ProductItem {
    id: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    stockSystem: number;
    costPrice: number;
    sellPrice: number;
}

interface CompareResult {
    productId: string;
    name: string;
    sku: string;
    category: string;
    unit: string;
    stockSystem: number;
    stockPhysical: number;
    difference: number;
    costPrice: number;
    estimatedLoss: number;
    status: "sesuai" | "kurang" | "lebih";
    suspicious: boolean;
    totalSold: number;
    totalOut: number;
    unaccounted: number;
    suspiciousNote: string | null;
}

interface AnalysisSummary {
    totalChecked: number;
    totalMatch: number;
    totalDiscrepancy: number;
    totalUnitsMissing: number;
    totalUnitsExtra: number;
    estimatedLoss: number;
    suspiciousCount: number;
    dateFrom: string;
    dateTo: string;
}

type Step = "setup" | "input" | "results";
type ScopeType = "all" | "category" | "specific";

const formatRp = (val: number) =>
    new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(val);

export default function StockTrackingPage() {
    const { data: session } = useSession();
    const roleName = typeof session?.user?.role === "string"
        ? session.user.role
        : (session?.user?.role as any)?.name ?? "";

    // Step state
    const [step, setStep] = React.useState<Step>("setup");

    // Setup state
    const [scope, setScope] = React.useState<ScopeType>("all");
    const [location, setLocation] = React.useState<"toko" | "gudang">("toko");
    const [selectedCategories, setSelectedCategories] = React.useState<string[]>([]);
    const [selectedProductIds, setSelectedProductIds] = React.useState<string[]>([]);
    const [categorySearch, setCategorySearch] = React.useState("");
    const [productSearch, setProductSearch] = React.useState("");
    const [dateFrom, setDateFrom] = React.useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split("T")[0];
    });
    const [dateTo, setDateTo] = React.useState(() => new Date().toISOString().split("T")[0]);

    // Data state
    const [products, setProducts] = React.useState<ProductItem[]>([]);
    const [physicalStocks, setPhysicalStocks] = React.useState<Record<string, number>>({});
    const [results, setResults] = React.useState<CompareResult[]>([]);
    const [summary, setSummary] = React.useState<AnalysisSummary | null>(null);
    const [loading, setLoading] = React.useState(false);
    const [resultFilter, setResultFilter] = React.useState<"all" | "selisih" | "mencurigakan">("all");
    const [tableSearch, setTableSearch] = React.useState("");

    // Available categories and products for selection
    const [availableCategories, setAvailableCategories] = React.useState<string[]>([]);
    const [allProducts, setAllProducts] = React.useState<{ id: string; name: string; sku: string }[]>([]);
    const [catPopoverOpen, setCatPopoverOpen] = React.useState(false);
    const [prodPopoverOpen, setProdPopoverOpen] = React.useState(false);

    // Load categories and products for setup dropdowns
    React.useEffect(() => {
        if (roleName && ["admin", "operator"].includes(roleName)) {
            fetch("/api/toko/products?perPage=9999&unitType=toko")
                .then((r) => r.json())
                .then((data) => {
                    const prods = data.data?.products || data.data || [];
                    setAllProducts(
                        prods.map((p: any) => ({ id: p.id, name: p.name, sku: p.sku || "" }))
                    );
                    const cats = [...new Set(prods.map((p: any) => p.category).filter(Boolean))] as string[];
                    setAvailableCategories(cats.sort());
                })
                .catch(() => {});
        }
    }, [roleName]);

    // Start tracking — fetch products based on scope
    const handleStartTracking = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({ scope, location });
            if (scope === "category" && selectedCategories.length > 0) {
                params.set("categories", selectedCategories.join(","));
            }
            if (scope === "specific" && selectedProductIds.length > 0) {
                params.set("productIds", selectedProductIds.join(","));
            }

            const res = await fetch(`/api/toko/stock-tracking/products?${params}`);
            if (!res.ok) throw new Error("Gagal memuat produk");
            const data = await res.json();
            setProducts(data.products);
            setPhysicalStocks({});
            setStep("input");
        } catch (err: any) {
            toast.error(err.message || "Gagal memuat data produk");
        } finally {
            setLoading(false);
        }
    };

    // Analyze results
    const handleAnalyze = async () => {
        const items = products
            .filter((p) => physicalStocks[p.id] !== undefined && physicalStocks[p.id] !== null)
            .map((p) => ({ productId: p.id, physicalStock: physicalStocks[p.id] }));

        if (items.length === 0) {
            toast.error("Belum ada stok fisik yang diisi");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/toko/stock-tracking/compare", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items, location, dateFrom, dateTo }),
            });
            if (!res.ok) throw new Error("Gagal menganalisis data");
            const data = await res.json();
            setResults(data.results);
            setSummary(data.summary);
            setStep("results");
        } catch (err: any) {
            toast.error(err.message || "Gagal menganalisis data");
        } finally {
            setLoading(false);
        }
    };

    // Export Excel
    const handleExport = () => {
        const filteredResults = getFilteredResults();
        const columns: ExportColumn[] = [
            { header: "No", key: "no", width: 5 },
            { header: "Produk", key: "name", width: 25 },
            { header: "SKU", key: "sku", width: 12 },
            { header: "Kategori", key: "category", width: 15 },
            { header: "Stok Sistem", key: "stockSystem", width: 12 },
            { header: "Stok Fisik", key: "stockPhysical", width: 12 },
            { header: "Selisih", key: "difference", width: 10 },
            { header: "Estimasi Kerugian (Rp)", key: "estimatedLoss", width: 18, format: (v) => Number(v).toLocaleString("id-ID") },
            { header: "Status", key: "status", width: 10 },
            { header: "Mencurigakan", key: "suspiciousLabel", width: 14 },
            { header: `Terjual (${summary ? Math.round((new Date(summary.dateTo).getTime() - new Date(summary.dateFrom).getTime()) / 86400000) : 7} hari)`, key: "totalSold", width: 14 },
            { header: "Keluar Lain", key: "totalOut", width: 12 },
            { header: "Potensi Hilang", key: "unaccounted", width: 14 },
            { header: "Detail", key: "suspiciousNote", width: 40 },
        ];

        const exportData = filteredResults.map((r, i) => ({
            ...r,
            no: i + 1,
            suspiciousLabel: r.suspicious ? "YA" : "Tidak",
            status: r.status === "kurang" ? "Kurang" : r.status === "lebih" ? "Lebih" : "Sesuai",
        }));

        exportToExcel(exportData, columns, `STOCK-CHECK-${location}`, "Stock Tracking");
    };

    // Computed values
    const checkedCount = products.filter((p) => physicalStocks[p.id] !== undefined && physicalStocks[p.id] !== null).length;
    const uncheckedCount = products.length - checkedCount;
    const discrepancyCount = products.filter((p) => {
        const phys = physicalStocks[p.id];
        return phys !== undefined && phys !== null && phys !== p.stockSystem;
    }).length;

    const getFilteredResults = () => {
        let filtered = results;
        if (resultFilter === "selisih") filtered = results.filter((r) => r.status !== "sesuai");
        if (resultFilter === "mencurigakan") filtered = results.filter((r) => r.suspicious);
        if (tableSearch) {
            const q = tableSearch.toLowerCase();
            filtered = filtered.filter(
                (r) => r.name.toLowerCase().includes(q) || r.sku.toLowerCase().includes(q) || r.category.toLowerCase().includes(q)
            );
        }
        return filtered;
    };

    // Role guard
    if (roleName && !["admin", "operator"].includes(roleName)) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <p className="text-muted-foreground">Akses tidak diizinkan</p>
            </div>
        );
    }

    // ─── STEP: SETUP ──────────────────────────────────────────────
    if (step === "setup") {
        return (
            <div className="space-y-6">
                <PageHeader title="Stock Tracking" description="Deteksi selisih stok fisik vs sistem untuk investigasi kecurangan" backHref="/toko" />

                <Card className="max-w-2xl">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <SearchCheck className="h-5 w-5" />
                            Mulai Pengecekan Stok
                        </CardTitle>
                        <CardDescription>Pilih produk yang ingin dicek, lalu bandingkan stok fisik dengan stok sistem</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Scope selection */}
                        <div className="space-y-3">
                            <Label className="text-base font-medium">Pilih Produk</Label>
                            <RadioGroup value={scope} onValueChange={(v) => setScope(v as ScopeType)} className="space-y-2">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="all" id="all" />
                                    <Label htmlFor="all">Semua Produk</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="category" id="category" />
                                    <Label htmlFor="category">Per Kategori</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="specific" id="specific" />
                                    <Label htmlFor="specific">Produk Spesifik</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Category selector */}
                        {scope === "category" && (
                            <div className="space-y-2">
                                <Label>Pilih Kategori</Label>
                                <Popover open={catPopoverOpen} onOpenChange={setCatPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-[40px] flex-wrap gap-1">
                                            {selectedCategories.length === 0 ? (
                                                <span className="text-muted-foreground">Pilih kategori...</span>
                                            ) : (
                                                selectedCategories.map((cat) => (
                                                    <Badge key={cat} variant="secondary" className="mr-1">
                                                        {cat}
                                                        <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedCategories((prev) => prev.filter((c) => c !== cat)); }}>
                                                            ×
                                                        </button>
                                                    </Badge>
                                                ))
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[300px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari kategori..." value={categorySearch} onValueChange={setCategorySearch} />
                                            <CommandList>
                                                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                                                <CommandGroup>
                                                    {availableCategories
                                                        .filter((c) => c.toLowerCase().includes(categorySearch.toLowerCase()))
                                                        .map((cat) => (
                                                            <CommandItem
                                                                key={cat}
                                                                onSelect={() => {
                                                                    setSelectedCategories((prev) =>
                                                                        prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
                                                                    );
                                                                }}
                                                            >
                                                                <div className={cn("mr-2 h-4 w-4 rounded border flex items-center justify-center", selectedCategories.includes(cat) && "bg-primary border-primary")}>
                                                                    {selectedCategories.includes(cat) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                                                                </div>
                                                                {cat}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Specific product selector */}
                        {scope === "specific" && (
                            <div className="space-y-2">
                                <Label>Pilih Produk</Label>
                                <Popover open={prodPopoverOpen} onOpenChange={setProdPopoverOpen}>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal h-auto min-h-[40px] flex-wrap gap-1">
                                            {selectedProductIds.length === 0 ? (
                                                <span className="text-muted-foreground">Cari dan pilih produk...</span>
                                            ) : (
                                                selectedProductIds.map((id) => {
                                                    const prod = allProducts.find((p) => p.id === id);
                                                    return prod ? (
                                                        <Badge key={id} variant="secondary" className="mr-1">
                                                            {prod.name}
                                                            <button className="ml-1 hover:text-destructive" onClick={(e) => { e.stopPropagation(); setSelectedProductIds((prev) => prev.filter((p) => p !== id)); }}>
                                                                ×
                                                            </button>
                                                        </Badge>
                                                    ) : null;
                                                })
                                            )}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-[350px] p-0" align="start">
                                        <Command>
                                            <CommandInput placeholder="Cari produk..." value={productSearch} onValueChange={setProductSearch} />
                                            <CommandList>
                                                <CommandEmpty>Tidak ditemukan</CommandEmpty>
                                                <CommandGroup>
                                                    {allProducts
                                                        .filter((p) => {
                                                            if (selectedProductIds.includes(p.id)) return false;
                                                            const q = productSearch.toLowerCase();
                                                            return p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
                                                        })
                                                        .slice(0, 50)
                                                        .map((prod) => (
                                                            <CommandItem
                                                                key={prod.id}
                                                                onSelect={() => {
                                                                    setSelectedProductIds((prev) => [...prev, prod.id]);
                                                                    setProductSearch("");
                                                                }}
                                                            >
                                                                <Package className="mr-2 h-4 w-4" />
                                                                <span>{prod.name}</span>
                                                                {prod.sku && <span className="ml-2 text-muted-foreground text-xs">({prod.sku})</span>}
                                                            </CommandItem>
                                                        ))}
                                                </CommandGroup>
                                            </CommandList>
                                        </Command>
                                    </PopoverContent>
                                </Popover>
                            </div>
                        )}

                        {/* Location */}
                        <div className="space-y-3">
                            <Label className="text-base font-medium">Lokasi Pengecekan</Label>
                            <RadioGroup value={location} onValueChange={(v) => setLocation(v as "toko" | "gudang")} className="flex gap-4">
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="toko" id="loc-toko" />
                                    <Label htmlFor="loc-toko">Toko (Etalase)</Label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <RadioGroupItem value="gudang" id="loc-gudang" />
                                    <Label htmlFor="loc-gudang">Gudang</Label>
                                </div>
                            </RadioGroup>
                        </div>

                        {/* Date range for suspicious analysis */}
                        <div className="space-y-3">
                            <Label className="text-base font-medium">Periode Analisis (untuk deteksi mencurigakan)</Label>
                            <div className="flex gap-3">
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-muted-foreground">Dari</Label>
                                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                                </div>
                                <div className="space-y-1 flex-1">
                                    <Label className="text-xs text-muted-foreground">Sampai</Label>
                                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                                </div>
                            </div>
                            <p className="text-xs text-muted-foreground">Sistem akan membandingkan selisih stok dengan total penjualan dalam periode ini</p>
                        </div>

                        {/* Start button */}
                        <Button onClick={handleStartTracking} disabled={loading || (scope === "category" && selectedCategories.length === 0) || (scope === "specific" && selectedProductIds.length === 0)} className="w-full">
                            {loading ? "Memuat..." : "Mulai Pengecekan"}
                            {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // ─── STEP: INPUT ──────────────────────────────────────────────
    if (step === "input") {
        const filteredProducts = tableSearch
            ? products.filter((p) =>
                p.name.toLowerCase().includes(tableSearch.toLowerCase()) ||
                p.sku.toLowerCase().includes(tableSearch.toLowerCase()) ||
                p.category.toLowerCase().includes(tableSearch.toLowerCase())
            )
            : products;

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("setup")} className="-ml-2 mb-2">
                        <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke Setup
                    </Button>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Tracking — Input Stok Fisik</h1>
                            <p className="text-muted-foreground">Lokasi: {location === "toko" ? "Toko (Etalase)" : "Gudang"} • {products.length} produk</p>
                        </div>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Total Produk</p>
                            <p className="text-xl font-bold">{products.length}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Sudah Dicek</p>
                            <p className="text-xl font-bold text-green-600">{checkedCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Belum Dicek</p>
                            <p className="text-xl font-bold text-amber-600">{uncheckedCount}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Ada Selisih</p>
                            <p className="text-xl font-bold text-red-600">{discrepancyCount}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Search + Actions */}
                <div className="flex items-center gap-3">
                    <Input placeholder="Cari produk..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="max-w-sm" />
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setStep("setup")}><ArrowLeft className="mr-2 h-4 w-4" />Setup</Button>
                    <Button onClick={handleAnalyze} disabled={loading || checkedCount === 0}>
                        {loading ? "Menganalisis..." : "Analisis Hasil"}
                        {!loading && <SearchCheck className="ml-2 h-4 w-4" />}
                    </Button>
                </div>

                {/* Product table */}
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-right">Stok Sistem</TableHead>
                                <TableHead className="text-right w-[120px]">Stok Fisik</TableHead>
                                <TableHead className="text-center">Satuan</TableHead>
                                <TableHead className="text-right">Selisih</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredProducts.map((product, idx) => {
                                const phys = physicalStocks[product.id];
                                const isFilled = phys !== undefined && phys !== null;
                                const diff = isFilled ? phys - product.stockSystem : null;
                                const status: "sesuai" | "kurang" | "lebih" | null = diff !== null
                                    ? diff === 0 ? "sesuai" : diff < 0 ? "kurang" : "lebih"
                                    : null;

                                return (
                                    <TableRow key={product.id} className={cn(!isFilled && "bg-amber-50 dark:bg-amber-950/20")}>
                                        <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{product.name}</div>
                                            {product.sku && <div className="text-xs text-muted-foreground">{product.sku}</div>}
                                        </TableCell>
                                        <TableCell><Badge variant="outline">{product.category || "-"}</Badge></TableCell>
                                        <TableCell className="text-right font-mono">{product.stockSystem}</TableCell>
                                        <TableCell className="text-right">
                                            <Input
                                                type="number"
                                                min="0"
                                                className="w-[100px] text-right ml-auto"
                                                placeholder="-"
                                                value={isFilled ? phys : ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    if (val === "") {
                                                        setPhysicalStocks((prev) => { const next = { ...prev }; delete next[product.id]; return next; });
                                                    } else {
                                                        setPhysicalStocks((prev) => ({ ...prev, [product.id]: parseInt(val, 10) || 0 }));
                                                    }
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center text-muted-foreground">{product.unit}</TableCell>
                                        <TableCell className={cn("text-right font-mono font-bold", diff !== null && diff < 0 && "text-red-600", diff !== null && diff > 0 && "text-blue-600")}>
                                            {diff !== null ? (diff > 0 ? `+${diff}` : diff) : "-"}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {status === "sesuai" && <Badge variant="secondary" className="bg-green-100 text-green-800"><CheckCircle2 className="h-3 w-3 mr-1" />Sesuai</Badge>}
                                            {status === "kurang" && <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Kurang</Badge>}
                                            {status === "lebih" && <Badge variant="secondary" className="bg-blue-100 text-blue-800"><ChevronUp className="h-3 w-3 mr-1" />Lebih</Badge>}
                                            {!status && <span className="text-muted-foreground text-sm">-</span>}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                            {filteredProducts.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                                        Tidak ada produk ditemukan
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    // ─── STEP: RESULTS ────────────────────────────────────────────
    if (step === "results" && summary) {
        const filteredResults = getFilteredResults();

        return (
            <div className="space-y-4">
                <div className="space-y-2">
                    <Button variant="ghost" size="sm" onClick={() => setStep("input")} className="-ml-2 mb-2">
                        <ArrowLeft className="mr-1 h-4 w-4" />Kembali ke Input
                    </Button>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="space-y-1">
                            <h1 className="text-2xl font-bold tracking-tight">Stock Tracking — Hasil Analisis</h1>
                            <p className="text-muted-foreground">Lokasi: {location === "toko" ? "Toko" : "Gudang"} • Periode: {new Date(summary.dateFrom).toLocaleDateString("id-ID")} - {new Date(summary.dateTo).toLocaleDateString("id-ID")}</p>
                        </div>
                    </div>
                </div>

                {/* Summary cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Dicek</p>
                            <p className="text-xl font-bold">{summary.totalChecked}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Sesuai</p>
                            <p className="text-xl font-bold text-green-600">{summary.totalMatch}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Ada Selisih</p>
                            <p className="text-xl font-bold text-amber-600">{summary.totalDiscrepancy}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Unit Hilang</p>
                            <p className="text-xl font-bold text-red-600">{summary.totalUnitsMissing}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Unit Lebih</p>
                            <p className="text-xl font-bold text-blue-600">{summary.totalUnitsExtra}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Est. Kerugian</p>
                            <p className="text-lg font-bold text-red-600">{formatRp(summary.estimatedLoss)}</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <p className="text-xs text-muted-foreground">Mencurigakan</p>
                            <p className="text-xl font-bold text-red-700">{summary.suspiciousCount}</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters & Actions */}
                <div className="flex items-center gap-3 flex-wrap">
                    <Input placeholder="Cari produk..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} className="max-w-xs" />
                    <div className="flex gap-1">
                        <Button variant={resultFilter === "all" ? "default" : "outline"} size="sm" onClick={() => setResultFilter("all")}>Semua ({results.length})</Button>
                        <Button variant={resultFilter === "selisih" ? "default" : "outline"} size="sm" onClick={() => setResultFilter("selisih")}>Selisih ({results.filter((r) => r.status !== "sesuai").length})</Button>
                        <Button variant={resultFilter === "mencurigakan" ? "destructive" : "outline"} size="sm" onClick={() => setResultFilter("mencurigakan")}>
                            <AlertTriangle className="h-3 w-3 mr-1" />Mencurigakan ({results.filter((r) => r.suspicious).length})
                        </Button>
                    </div>
                    <div className="flex-1" />
                    <Button variant="outline" onClick={() => setStep("input")}><ArrowLeft className="mr-2 h-4 w-4" />Input</Button>
                    <Button variant="outline" onClick={handleExport}><Download className="mr-2 h-4 w-4" />Export Excel</Button>
                </div>

                {/* Results table */}
                <div className="border rounded-lg">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[40px]">No</TableHead>
                                <TableHead>Produk</TableHead>
                                <TableHead>Kategori</TableHead>
                                <TableHead className="text-right">Sistem</TableHead>
                                <TableHead className="text-right">Fisik</TableHead>
                                <TableHead className="text-right">Selisih</TableHead>
                                <TableHead className="text-right">Kerugian</TableHead>
                                <TableHead className="text-center">Status</TableHead>
                                <TableHead className="text-center">Mencurigakan</TableHead>
                                <TableHead>Detail</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredResults.map((r, idx) => (
                                <TableRow key={r.productId} className={cn(r.suspicious && "bg-red-50 dark:bg-red-950/20")}>
                                    <TableCell className="text-muted-foreground">{idx + 1}</TableCell>
                                    <TableCell>
                                        <div className="font-medium">{r.name}</div>
                                        {r.sku && <div className="text-xs text-muted-foreground">{r.sku}</div>}
                                    </TableCell>
                                    <TableCell><Badge variant="outline">{r.category || "-"}</Badge></TableCell>
                                    <TableCell className="text-right font-mono">{r.stockSystem}</TableCell>
                                    <TableCell className="text-right font-mono">{r.stockPhysical}</TableCell>
                                    <TableCell className={cn("text-right font-mono font-bold", r.difference < 0 && "text-red-600", r.difference > 0 && "text-blue-600")}>
                                        {r.difference > 0 ? `+${r.difference}` : r.difference}
                                    </TableCell>
                                    <TableCell className="text-right">{r.estimatedLoss > 0 ? formatRp(r.estimatedLoss) : "-"}</TableCell>
                                    <TableCell className="text-center">
                                        {r.status === "sesuai" && <Badge variant="secondary" className="bg-green-100 text-green-800">Sesuai</Badge>}
                                        {r.status === "kurang" && <Badge variant="destructive">Kurang</Badge>}
                                        {r.status === "lebih" && <Badge variant="secondary" className="bg-blue-100 text-blue-800">Lebih</Badge>}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        {r.suspicious ? (
                                            <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />YA</Badge>
                                        ) : (
                                            <span className="text-muted-foreground text-sm">-</span>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground max-w-[250px]">
                                        {r.suspiciousNote || "-"}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredResults.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                                        Tidak ada hasil
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </div>
        );
    }

    return null;
}
```

- [ ] **Step 2: Verify the page compiles**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: No type errors. Fix any issues (e.g., missing shadcn components like `RadioGroup`, `Command`, etc. — these should already exist in the project).

- [ ] **Step 3: Test the page in browser**

1. Login as admin toko
2. Navigate to `/toko/stock-tracking`
3. Verify the 3-step flow works:
   - Setup: select scope, location, date range
   - Input: fill physical stock values
   - Results: view discrepancies and suspicious flags
4. Test export Excel button
5. Test all 3 filter buttons (Semua, Selisih, Mencurigakan)

- [ ] **Step 4: Commit**

```bash
git add src/app/\(protected\)/toko/stock-tracking/page.tsx
git commit -m "feat: add Stock Tracking page with 3-step wizard (setup, input, results)"
```

---

## Task 5: Final Integration Test & Verification

- [ ] **Step 1: Full end-to-end test**

1. Login as admin toko
2. Verify "Stock Tracking" appears in sidebar under "TOKO & PRODUK"
3. Click it — verify page loads with setup card
4. Select "Semua Produk", location "Toko", default date range
5. Click "Mulai Pengecekan" — verify product table loads
6. Fill in a few products with different values (some matching, some less, some more)
7. Click "Analisis Hasil" — verify results table shows
8. Verify suspicious detection works for products with less stock than system
9. Click "Export Excel" — verify file downloads
10. Click back buttons — verify navigation between steps works

- [ ] **Step 2: Test edge cases**

1. Login as kasir — verify "Stock Tracking" does NOT appear in sidebar
2. Navigate directly to `/toko/stock-tracking` as kasir — verify "Akses tidak diizinkan"
3. Test with scope "Per Kategori" — select a category, verify only those products load
4. Test with scope "Produk Spesifik" — select specific products, verify only those load
5. Test with empty results (no discrepancies) — verify summary shows all green
6. Test with all products having discrepancies — verify summary shows counts

- [ ] **Step 3: Test API directly (optional)**

```bash
# Test products endpoint
curl -b cookie.txt "http://localhost:3000/api/toko/stock-tracking/products?scope=all&location=toko"

# Test compare endpoint
curl -b cookie.txt -X POST "http://localhost:3000/api/toko/stock-tracking/compare" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"productId":"some-id","physicalStock":5}],"location":"toko"}'
```

- [ ] **Step 4: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix: stock tracking edge cases and integration fixes"
```

---

## Self-Review Checklist

### Spec Coverage

| Spec Requirement | Task |
|---|---|
| Halaman `/toko/stock-tracking` | Task 4 |
| Scope: Semua / Kategori / Spesifik | Task 4 (setup step) |
| Pilih lokasi: Gudang / Toko | Task 4 (setup step) |
| Input stok fisik per produk | Task 4 (input step) |
| Selisih auto-kalkulasi real-time | Task 4 (input step, computed in render) |
| Status badge: Sesuai/Kurang/Lebih | Task 4 (input + results steps) |
| Deteksi mencurigakan | Task 2 (compare API) + Task 4 (results step) |
| Filter hasil: Semua/Selisih/Mencurigakan | Task 4 (results step) |
| Export Excel | Task 4 (handleExport using exportToExcel) |
| Navigasi sidebar admin toko | Task 3 |
| Akses: admin/operator only | Task 1 (API role check) + Task 4 (page role guard) |
| Kasir: tidak bisa akses | Task 3 (nav hidden) + Task 4 (page guard) |

### Placeholder Scan
No TBD, TODO, or placeholder steps found. All steps contain actual code.

### Type Consistency
- `CompareResult` type in page matches response shape from compare API
- `ProductItem` type matches response from products API
- All component props match shadcn/ui component signatures
- `ExportColumn` usage matches the interface from `export-utils.ts`
