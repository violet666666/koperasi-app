# F&B Menu Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace retail-style product forms in Cafe LSP and Resto with an F&B-specific menu management system: category CRUD, menu type toggle, tax settings, variant grouping, and POS color coding — without affecting Toko or any other unit.

**Architecture:** New `StoreCategory` table for F&B categories. Add 6 nullable/defaulted fields to `StoreProduct`. All changes scoped via `FB_UNITS` constant (`cafe_lsp`, `resto`, `resto_cafe`, `coffe_latar`). Toko code paths are never touched — every new API branch is guarded by `isFbUnit()`.

**Tech Stack:** Next.js App Router, Prisma, shadcn/ui, TypeScript

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/constants/units.ts` | Already exists — will add `FB_UNITS`, `isFbUnit()` to existing file |
| `src/components/forms/fb-menu-form.tsx` | Shared F&B menu add/edit form component |
| `src/app/(protected)/cafe-lsp/produk/tambah/page.tsx` | Replace current re-export with F&B form page |
| `src/app/(protected)/cafe-lsp/produk/[id]/edit/page.tsx` | NEW: Edit menu page for Cafe LSP |
| `src/app/(protected)/resto/produk/tambah/page.tsx` | Replace current re-export with F&B form page |
| `src/app/(protected)/resto/produk/[id]/edit/page.tsx` | NEW: Edit menu page for Resto |

### Modified Files
| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `StoreCategory` model + 6 fields to `StoreProduct` |
| `src/app/api/toko/products/route.ts` | Accept new F&B fields in POST, return in GET |
| `src/app/api/toko/products/[id]/route.ts` | Accept new F&B fields in PUT |
| `src/app/api/toko/products/categories/route.ts` | Add F&B dual-mode GET, PUT/DELETE for StoreCategory, add-category POST |
| `src/app/api/admin/migrate/route.ts` | Add ALTER TABLE for new columns + CREATE TABLE for store_categories |
| `src/app/(protected)/cafe-lsp/kasir/page.tsx` | Category tabs from StoreCategory, color cards, variant grouping |
| `src/app/(protected)/resto/kasir/page.tsx` | Same POS changes |
| `src/app/(protected)/cafe-lsp/produk/page.tsx` | Replace re-export with F&B product list page with category management |
| `src/app/(protected)/resto/produk/page.tsx` | Same product list changes |

### Unchanged Files (DO NOT TOUCH)
- `src/app/api/toko/sales/route.ts` — stock deduction logic is correct
- `src/app/api/toko/split-bill/route.ts` — same stock deduction logic
- `src/app/(protected)/toko/**` — all Toko pages
- `src/app/api/mobile/toko/route.ts` — mobile POS
- `src/app/api/toko/products/import/route.ts` — import unchanged
- `src/app/api/toko/products/bulk/route.ts` — bulk unchanged

---

## Task 1: Add FB_UNITS Constant and Prisma Schema Changes

**Files:**
- Modify: `src/lib/constants/units.ts` (add `FB_UNITS` + `isFbUnit()`)
- Modify: `prisma/schema.prisma` (add `StoreCategory` model + 6 fields to `StoreProduct`)
- Modify: `src/app/api/admin/migrate/route.ts` (add ALTER TABLE + CREATE TABLE)

- [ ] **Step 1: Add FB_UNITS and isFbUnit to units.ts**

Append to end of `src/lib/constants/units.ts` (after the `getServiceUnits()` function at line 43):

```typescript
export const FB_UNITS = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"] as const;
export type FbUnitType = (typeof FB_UNITS)[number];

export function isFbUnit(unitType: string | null | undefined): boolean {
  return !!unitType && (FB_UNITS as readonly string[]).includes(unitType);
}
```

- [ ] **Step 2: Add StoreCategory model to prisma/schema.prisma**

Insert BEFORE the `StoreProduct` model (before line 817):

```prisma
model StoreCategory {
  id        Int      @id @default(autoincrement())
  name      String
  unitType  String   @map("unit_type")
  sortOrder Int      @default(0) @map("sort_order")
  isActive  Boolean  @default(true) @map("is_active")
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  products StoreProduct[]

  @@unique([name, unitType])
  @@index([unitType, isActive])
  @@map("store_categories")
}
```

- [ ] **Step 3: Add 6 new fields to StoreProduct model in prisma/schema.prisma**

Inside `StoreProduct` model, after the `deletedAt` field (line 839) and before the relation fields (line 841), add:

```prisma
  // --- F&B Menu Management fields (all nullable/defaulted, safe for Toko) ---
  categoryId     Int?             @map("category_id")
  categoryRel    StoreCategory?   @relation(fields: [categoryId], references: [id])
  menuType       String?          @map("menu_type")            // "inventory" | "kitchen" | null
  taxType        String           @default("inclusive") @map("tax_type") // "inclusive" | "exclusive" | "none"
  taxRate        Decimal          @default(11.0) @map("tax_rate") @db.Decimal(5, 2)
  posColor       String?          @map("pos_color")            // Hex color: "#FF5722"
  variantGroupId String?          @map("variant_group_id")     // Groups variants: "latte"
```

Also add `@@index([categoryId])` to the index list.

- [ ] **Step 4: Add migration statements to migrate/route.ts**

In `src/app/api/admin/migrate/route.ts`, before the `return NextResponse.json({ success: true, results })` at line 165, add:

```typescript
        // ── F&B Menu Management: store_categories table ──────────────────
        const storeCatExists = await tableExists("store_categories");
        if (!storeCatExists) {
            await prisma.$executeRawUnsafe(`
                CREATE TABLE store_categories (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    unit_type TEXT NOT NULL,
                    sort_order INTEGER NOT NULL DEFAULT 0,
                    is_active BOOLEAN NOT NULL DEFAULT true,
                    created_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMP(3) NOT NULL DEFAULT NOW(),
                    CONSTRAINT store_categories_name_unit_type_unique UNIQUE (name, unit_type)
                )
            `);
            await prisma.$executeRawUnsafe(`CREATE INDEX idx_store_categories_unit_active ON store_categories(unit_type, is_active)`);
            results.push("Created store_categories table");
        } else {
            results.push("store_categories table already exists");
        }

        // F&B fields on store_products
        const fbColumns: [string, string][] = [
            ["category_id", "INTEGER"],
            ["menu_type", "TEXT"],
            ["tax_type", "TEXT DEFAULT 'inclusive'"],
            ["tax_rate", "DECIMAL(5,2) DEFAULT 11.0"],
            ["pos_color", "TEXT"],
            ["variant_group_id", "TEXT"],
        ];
        for (const [col, type] of fbColumns) {
            const exists = await columnExists("store_products", col);
            if (!exists) {
                await prisma.$executeRawUnsafe(`ALTER TABLE store_products ADD COLUMN ${col} ${type}`);
                results.push(`Added store_products.${col} (${type})`);
            } else {
                results.push(`store_products.${col} already exists`);
            }
        }
```

- [ ] **Step 5: Run prisma db push locally**

Run: `npx prisma db push`
Expected: Schema synchronized, no errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants/units.ts prisma/schema.prisma src/app/api/admin/migrate/route.ts
git commit -m "feat: add StoreCategory model, FB_UNITS constant, and F&B product fields to schema"
```

---

## Task 2: Category CRUD API Endpoints

**Files:**
- Modify: `src/app/api/toko/products/categories/route.ts` (dual-mode GET, POST for F&B create, PUT, DELETE)

- [ ] **Step 1: Rewrite categories route.ts with F&B dual-mode support**

Replace the entire file `src/app/api/toko/products/categories/route.ts` with:

```typescript
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isFbUnit } from "@/lib/constants/units";

// GET /api/toko/products/categories — List categories with product counts
// F&B units: from StoreCategory table (sorted by sortOrder)
// Toko/other: from StoreProduct.category string aggregate (unchanged)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || undefined;

        if (unitType && isFbUnit(unitType)) {
            const categories = await prisma.storeCategory.findMany({
                where: { unitType, isActive: true },
                orderBy: { sortOrder: "asc" },
                include: {
                    _count: {
                        select: {
                            products: {
                                where: { deletedAt: null, isActive: true },
                            },
                        },
                    },
                },
            });
            return NextResponse.json({
                data: categories.map((c) => ({
                    id: c.id,
                    name: c.name,
                    count: c._count.products,
                    sortOrder: c.sortOrder,
                })),
            });
        }

        // Original Toko/other: aggregate from StoreProduct.category string
        const products = await prisma.storeProduct.findMany({
            where: {
                deletedAt: null,
                isActive: true,
                ...(unitType && { unitType }),
                category: { not: null },
            },
            select: { category: true },
        });

        const countMap = new Map<string, number>();
        for (const p of products) {
            if (p.category) {
                countMap.set(p.category, (countMap.get(p.category) || 0) + 1);
            }
        }

        const categories = Array.from(countMap.entries())
            .map(([name, count]) => ({ name, count }))
            .sort((a, b) => a.name.localeCompare(b.name));

        return NextResponse.json({ data: categories });
    } catch (error) {
        console.error("GET /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memuat kategori" }, { status: 500 });
    }
}

// POST /api/toko/products/categories — Create (F&B) or rename/delete (Toko)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const unitType = (session.user as any).unitType || "toko";
        const body = await request.json();
        const { action, category, newCategory } = body;

        // F&B: Create new category in StoreCategory table
        if (isFbUnit(unitType) && (!action || action === "create")) {
            const name = (category || newCategory || "").trim();
            if (!name) {
                return NextResponse.json({ message: "Nama kategori wajib diisi" }, { status: 400 });
            }

            const existing = await prisma.storeCategory.findFirst({
                where: { name: { equals: name, mode: "insensitive" }, unitType },
            });
            if (existing) {
                return NextResponse.json({ message: `Kategori "${name}" sudah ada` }, { status: 409 });
            }

            const maxSort = await prisma.storeCategory.aggregate({
                where: { unitType, isActive: true },
                _max: { sortOrder: true },
            });

            const cat = await prisma.storeCategory.create({
                data: {
                    name,
                    unitType,
                    sortOrder: (maxSort._max.sortOrder ?? -1) + 1,
                },
            });

            return NextResponse.json({ data: { id: cat.id, name: cat.name, sortOrder: cat.sortOrder } }, { status: 201 });
        }

        // Toko/other: existing rename/delete logic (unchanged)
        if (!action || !category) {
            return NextResponse.json({ message: "Action dan nama kategori wajib diisi" }, { status: 400 });
        }

        const unitFilter = { unitType, deletedAt: null };

        if (action === "rename") {
            if (!newCategory || !newCategory.trim()) {
                return NextResponse.json({ message: "Nama kategori baru tidak boleh kosong" }, { status: 400 });
            }
            if (newCategory.trim().toLowerCase() === category.trim().toLowerCase()) {
                return NextResponse.json({ message: "Nama kategori baru sama dengan yang lama" }, { status: 400 });
            }

            const existingWithNew = await prisma.storeProduct.findFirst({
                where: { ...unitFilter, category: { equals: newCategory.trim(), mode: "insensitive" } },
            });
            if (existingWithNew) {
                return NextResponse.json(
                    { message: `Kategori "${newCategory.trim()}" sudah ada. Gunakan nama lain.` },
                    { status: 409 }
                );
            }

            const result = await prisma.storeProduct.updateMany({
                where: { ...unitFilter, category },
                data: { category: newCategory.trim() },
            });

            return NextResponse.json({
                message: `Kategori "${category}" berhasil diubah ke "${newCategory.trim()}" (${result.count} produk diperbarui)`,
                data: { affected: result.count },
            });
        }

        if (action === "delete") {
            const result = await prisma.storeProduct.updateMany({
                where: { ...unitFilter, category },
                data: { category: null },
            });

            return NextResponse.json({
                message: `Kategori "${category}" berhasil dihapus (${result.count} produk dipindahkan ke "Tanpa Kategori")`,
                data: { affected: result.count },
            });
        }

        return NextResponse.json({ message: `Aksi "${action}" tidak dikenal. Gunakan "rename" atau "delete".` }, { status: 400 });
    } catch (error) {
        console.error("POST /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memproses permintaan kategori" }, { status: 500 });
    }
}

// PUT /api/toko/products/categories — Update F&B category (name, sortOrder)
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const body = await request.json();
        const { id, name, sortOrder } = body;

        if (!id) {
            return NextResponse.json({ message: "ID kategori wajib diisi" }, { status: 400 });
        }

        const existing = await prisma.storeCategory.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ message: "Kategori tidak ditemukan" }, { status: 404 });
        }

        if (!isFbUnit(existing.unitType)) {
            return NextResponse.json({ message: "Endpoint ini hanya untuk unit F&B" }, { status: 400 });
        }

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) {
            const trimmed = name.trim();
            if (!trimmed) return NextResponse.json({ message: "Nama kategori tidak boleh kosong" }, { status: 400 });

            const dup = await prisma.storeCategory.findFirst({
                where: { name: { equals: trimmed, mode: "insensitive" }, unitType: existing.unitType, NOT: { id } },
            });
            if (dup) return NextResponse.json({ message: `Kategori "${trimmed}" sudah ada` }, { status: 409 });

            updateData.name = trimmed;
        }
        if (sortOrder !== undefined) updateData.sortOrder = sortOrder;

        const updated = await prisma.storeCategory.update({
            where: { id },
            data: updateData,
        });

        return NextResponse.json({ data: { id: updated.id, name: updated.name, sortOrder: updated.sortOrder } });
    } catch (error) {
        console.error("PUT /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal memperbarui kategori" }, { status: 500 });
    }
}

// DELETE /api/toko/products/categories — Delete F&B category, unlink products
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengelola kategori" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const id = parseInt(searchParams.get("id") || "0");
        if (!id) {
            return NextResponse.json({ message: "ID kategori wajib diisi" }, { status: 400 });
        }

        const existing = await prisma.storeCategory.findUnique({ where: { id } });
        if (!existing) {
            return NextResponse.json({ message: "Kategori tidak ditemukan" }, { status: 404 });
        }

        if (!isFbUnit(existing.unitType)) {
            return NextResponse.json({ message: "Endpoint ini hanya untuk unit F&B" }, { status: 400 });
        }

        await prisma.$transaction([
            prisma.storeProduct.updateMany({
                where: { categoryId: id },
                data: { categoryId: null, category: null },
            }),
            prisma.storeCategory.update({
                where: { id },
                data: { isActive: false },
            }),
        ]);

        return NextResponse.json({ message: `Kategori "${existing.name}" berhasil dihapus` });
    } catch (error) {
        console.error("DELETE /api/toko/products/categories error:", error);
        return NextResponse.json({ message: "Gagal menghapus kategori" }, { status: 500 });
    }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/toko/products/categories/route.ts
git commit -m "feat: add F&B category CRUD with dual-mode GET (StoreCategory for F&B, string aggregate for Toko)"
```

---

## Task 3: Modify Products API to Accept and Return F&B Fields

**Files:**
- Modify: `src/app/api/toko/products/route.ts` (POST accept new fields, GET return new fields)
- Modify: `src/app/api/toko/products/[id]/route.ts` (PUT accept new fields)

- [ ] **Step 1: Add F&B fields to GET response mapping**

In `src/app/api/toko/products/route.ts`, update the `mapped` array (lines 93-110). Add these fields after `unitType: p.unitType,` (line 109):

```typescript
            // F&B fields (null/defaults for Toko — harmless)
            categoryId: p.categoryId ?? null,
            menuType: p.menuType ?? null,
            taxType: p.taxType ?? "inclusive",
            taxRate: Number(p.taxRate ?? 11.0),
            posColor: p.posColor ?? null,
            variantGroupId: p.variantGroupId ?? null,
```

- [ ] **Step 2: Add F&B fields to POST create handler**

In `src/app/api/toko/products/route.ts`, in the `POST` function:

**A)** Destructure new fields from body (line 158). Change:
```typescript
const { sku, name, category, costPrice, sellPrice, discountType, discountValue, stock, stockGdg, stockToko, minStock, unit, isService, imageUrl, unitType, productType, trackStock } = body;
```
to:
```typescript
const { sku, name, category, costPrice, sellPrice, discountType, discountValue, stock, stockGdg, stockToko, minStock, unit, isService, imageUrl, unitType, productType, trackStock, categoryId, menuType, taxType, taxRate, posColor, variantGroupId } = body;
```

**B)** In the restore block (line 183-204), add after `trackStock: ...`:
```typescript
                        ...(categoryId !== undefined && { categoryId }),
                        ...(menuType !== undefined && { menuType }),
                        ...(taxType !== undefined && { taxType }),
                        ...(taxRate !== undefined && { taxRate: taxRate ?? 11.0 }),
                        ...(posColor !== undefined && { posColor: posColor || null }),
                        ...(variantGroupId !== undefined && { variantGroupId: variantGroupId || null }),
```

**C)** In the create block (line 214-233), add after `trackStock: ...`:
```typescript
                ...(categoryId !== undefined && { categoryId }),
                ...(menuType !== undefined && { menuType }),
                ...(taxType !== undefined && { taxType }),
                ...(taxRate !== undefined && { taxRate: taxRate ?? 11.0 }),
                ...(posColor !== undefined && { posColor: posColor || null }),
                ...(variantGroupId !== undefined && { variantGroupId: variantGroupId || null }),
```

- [ ] **Step 3: Add F&B fields to PUT handler**

In `src/app/api/toko/products/[id]/route.ts`, add these lines after `if (body.trackStock !== undefined) updateData.trackStock = !!body.trackStock;` (line 108):

```typescript
        if (body.categoryId !== undefined) updateData.categoryId = body.categoryId || null;
        if (body.menuType !== undefined) updateData.menuType = body.menuType || null;
        if (body.taxType !== undefined) updateData.taxType = body.taxType;
        if (body.taxRate !== undefined) updateData.taxRate = body.taxRate;
        if (body.posColor !== undefined) updateData.posColor = body.posColor || null;
        if (body.variantGroupId !== undefined) updateData.variantGroupId = body.variantGroupId || null;
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/toko/products/route.ts src/app/api/toko/products/\[id\]/route.ts
git commit -m "feat: accept and return F&B fields (categoryId, menuType, taxType, taxRate, posColor, variantGroupId) in products API"
```

---

## Task 4: Create F&B Menu Form Component

**Files:**
- Create: `src/components/forms/fb-menu-form.tsx`

- [ ] **Step 1: Create the shared F&B menu form component**

Create `src/components/forms/fb-menu-form.tsx` with the following content. This component handles both add and edit modes for F&B menu items:

```tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save, Package, ChefHat, ImagePlus, X, Palette, Plus } from "lucide-react";

interface Category {
    id: number;
    name: string;
    sortOrder: number;
}

interface FbMenuFormProps {
    unitType: string;
    backHref: string;
    editProduct?: any; // null = add mode, object = edit mode
}

const TAX_OPTIONS = [
    { value: "inclusive", label: "Termasuk PPN (Harga sudah termasuk pajak)" },
    { value: "exclusive", label: "Belum Termasuk PPN (Pajak ditambahkan saat transaksi)" },
    { value: "none", label: "Tanpa PPN" },
] as const;

export default function FbMenuForm({ unitType, backHref, editProduct }: FbMenuFormProps) {
    const router = useRouter();
    const isEdit = !!editProduct;
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [categories, setCategories] = React.useState<Category[]>([]);

    const [form, setForm] = React.useState({
        sku: editProduct?.sku || "",
        name: editProduct?.name || "",
        categoryId: editProduct?.categoryId?.toString() || "",
        description: "",
        imageUrl: editProduct?.imageUrl || "",
        menuType: editProduct?.menuType || "inventory", // "inventory" | "kitchen"
        costPrice: editProduct?.costPrice ? String(editProduct.costPrice) : "",
        sellPrice: editProduct?.sellPrice ? String(editProduct.sellPrice) : "",
        taxType: editProduct?.taxType || "inclusive",
        taxRate: editProduct?.taxRate ? String(editProduct.taxRate) : "11",
        variantGroupId: editProduct?.variantGroupId || "",
        posColor: editProduct?.posColor || "",
        unit: editProduct?.unit || "pcs",
        isActive: editProduct?.isActive ?? true,
        // Stock fields (only for inventory type)
        stockGdg: editProduct?.stockGdg ? String(editProduct.stockGdg) : "0",
        stockToko: editProduct?.stockToko ? String(editProduct.stockToko) : "0",
        minStock: editProduct?.minStock ? String(editProduct.minStock) : "0",
    });

    const [imagePreview, setImagePreview] = React.useState<string | null>(
        editProduct?.imageUrl || null
    );
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const isKitchen = form.menuType === "kitchen";

    // Fetch F&B categories
    React.useEffect(() => {
        fetch(`/api/toko/products/categories?unitType=${unitType}`)
            .then((r) => r.json())
            .then((data) => {
                if (data.data) {
                    setCategories(data.data);
                }
            })
            .catch(() => {});
    }, [unitType]);

    const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        if (file.size > 1 * 1024 * 1024) {
            toast.error("Ukuran gambar maksimal 1MB");
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = reader.result as string;
            setForm((prev) => ({ ...prev, imageUrl: base64 }));
            setImagePreview(base64);
        };
        reader.readAsDataURL(file);
    };

    const removeImage = () => {
        setForm((prev) => ({ ...prev, imageUrl: "" }));
        setImagePreview(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!form.name.trim()) {
            toast.error("Nama Menu wajib diisi");
            return;
        }

        const sellPriceNum = parseFloat(form.sellPrice);
        if (!form.sellPrice || isNaN(sellPriceNum) || sellPriceNum < 0) {
            toast.error("Harga Jual harus berupa angka yang valid");
            return;
        }

        const selectedCat = categories.find((c) => c.id.toString() === form.categoryId);

        setIsSubmitting(true);
        try {
            const stockGdgVal = parseInt(form.stockGdg) || 0;
            const stockTokoVal = parseInt(form.stockToko) || 0;

            const payload: Record<string, unknown> = {
                sku: form.sku.trim() || `MENU-${Date.now()}`,
                name: form.name.trim(),
                category: selectedCat?.name || null, // string field (backward compat)
                categoryId: form.categoryId ? parseInt(form.categoryId) : null,
                costPrice: parseFloat(form.costPrice) || 0,
                sellPrice: sellPriceNum,
                unit: form.unit || "pcs",
                imageUrl: form.imageUrl || null,
                unitType,
                productType: "finished",
                menuType: form.menuType,
                trackStock: !isKitchen,
                taxType: form.taxType,
                taxRate: parseFloat(form.taxRate) || 11,
                posColor: form.posColor || null,
                variantGroupId: form.variantGroupId.trim() || null,
                isActive: form.isActive,
            };

            if (isKitchen) {
                payload.stock = 0;
                payload.stockGdg = 0;
                payload.stockToko = 0;
                payload.minStock = 0;
            } else {
                payload.stock = stockGdgVal + stockTokoVal;
                payload.stockGdg = stockGdgVal;
                payload.stockToko = stockTokoVal;
                payload.minStock = parseInt(form.minStock) || 0;
            }

            const url = isEdit ? `/api/toko/products/${editProduct.id}` : "/api/toko/products";
            const method = isEdit ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json();
            if (!res.ok) {
                toast.error(json.message || "Gagal menyimpan menu");
                return;
            }

            toast.success(isEdit ? "Menu berhasil diperbarui!" : "Menu berhasil ditambahkan!");
            router.push(backHref);
        } catch (error) {
            console.error("Submit error:", error);
            toast.error("Gagal menyimpan menu. Periksa koneksi internet Anda.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit}>
            {/* Section A: Info Menu */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        Informasi Menu
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="name">Nama Menu <span className="text-red-500">*</span></Label>
                            <Input
                                id="name"
                                placeholder="Contoh: Kopi Latte"
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sku">SKU / Kode Menu</Label>
                            <Input
                                id="sku"
                                placeholder="Auto-generated jika kosong"
                                value={form.sku}
                                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="categoryId">Kategori <span className="text-red-500">*</span></Label>
                            <Select
                                value={form.categoryId}
                                onValueChange={(v) => setForm((p) => ({ ...p, categoryId: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Pilih kategori" />
                                </SelectTrigger>
                                <SelectContent>
                                    {categories.map((cat) => (
                                        <SelectItem key={cat.id} value={cat.id.toString()}>
                                            {cat.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="unit">Satuan</Label>
                            <Select
                                value={form.unit}
                                onValueChange={(v) => setForm((p) => ({ ...p, unit: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="pcs">Pcs</SelectItem>
                                    <SelectItem value="cup">Cup</SelectItem>
                                    <SelectItem value="glass">Glass</SelectItem>
                                    <SelectItem value="plate">Plate</SelectItem>
                                    <SelectItem value="bowl">Bowl</SelectItem>
                                    <SelectItem value="portion">Portion</SelectItem>
                                    <SelectItem value="bottle">Bottle</SelectItem>
                                    <SelectItem value="pack">Pack</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Deskripsi (Opsional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Deskripsi singkat menu..."
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            rows={2}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Section B: Jenis Menu */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <ChefHat className="h-5 w-5" />
                        Jenis Menu
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex gap-4">
                        <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, menuType: "inventory" }))}
                            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                                !isKitchen
                                    ? "border-blue-500 bg-blue-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <div className="font-semibold">Produk Inventaris</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Stok di-track, berkurang saat transaksi
                            </div>
                        </button>
                        <button
                            type="button"
                            onClick={() => setForm((p) => ({ ...p, menuType: "kitchen" }))}
                            className={`flex-1 p-4 rounded-lg border-2 text-left transition-colors ${
                                isKitchen
                                    ? "border-orange-500 bg-orange-50"
                                    : "border-gray-200 hover:border-gray-300"
                            }`}
                        >
                            <div className="font-semibold">Menu Dapur</div>
                            <div className="text-sm text-muted-foreground mt-1">
                                Tanpa tracking stok, toggle Available / 86&apos;d
                            </div>
                        </button>
                    </div>

                    {/* Kitchen: availability toggle */}
                    {isKitchen && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-orange-50 border border-orange-200">
                            <div>
                                <Label className="font-medium">Status Ketersediaan</Label>
                                <p className="text-sm text-muted-foreground">
                                    {form.isActive ? "Available — bisa dipesan" : "86'd (Sold Out) — tidak bisa dipesan"}
                                </p>
                            </div>
                            <Switch
                                checked={form.isActive}
                                onCheckedChange={(v) => setForm((p) => ({ ...p, isActive: v }))}
                            />
                        </div>
                    )}

                    {/* Inventory: stock fields */}
                    {!isKitchen && (
                        <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                            <div className="space-y-2">
                                <Label htmlFor="stockGdg">Stock Gdg</Label>
                                <Input
                                    id="stockGdg"
                                    type="number"
                                    min={0}
                                    value={form.stockGdg}
                                    onChange={(e) => setForm((p) => ({ ...p, stockGdg: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="stockToko">Stock Toko</Label>
                                <Input
                                    id="stockToko"
                                    type="number"
                                    min={0}
                                    value={form.stockToko}
                                    onChange={(e) => setForm((p) => ({ ...p, stockToko: e.target.value }))}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="minStock">Min. Stock</Label>
                                <Input
                                    id="minStock"
                                    type="number"
                                    min={0}
                                    value={form.minStock}
                                    onChange={(e) => setForm((p) => ({ ...p, minStock: e.target.value }))}
                                />
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Section C: Harga & Pajak */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg">Harga & Pajak</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="costPrice">HPP (Harga Pokok)</Label>
                            <Input
                                id="costPrice"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={form.costPrice}
                                onChange={(e) => setForm((p) => ({ ...p, costPrice: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="sellPrice">Harga Jual <span className="text-red-500">*</span></Label>
                            <Input
                                id="sellPrice"
                                type="number"
                                min={0}
                                placeholder="0"
                                value={form.sellPrice}
                                onChange={(e) => setForm((p) => ({ ...p, sellPrice: e.target.value }))}
                            />
                        </div>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label htmlFor="taxType">Pengaturan Pajak</Label>
                            <Select
                                value={form.taxType}
                                onValueChange={(v) => setForm((p) => ({ ...p, taxType: v }))}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {TAX_OPTIONS.map((opt) => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="taxRate">Tarif PPN (%)</Label>
                            <Input
                                id="taxRate"
                                type="number"
                                min={0}
                                max={100}
                                step="0.1"
                                value={form.taxRate}
                                onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Section D: Varian */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg">Varian (Opsional)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="variantGroupId">Grup Varian</Label>
                        <Input
                            id="variantGroupId"
                            placeholder='Contoh: "latte" untuk grup Latte S/M/L'
                            value={form.variantGroupId}
                            onChange={(e) => setForm((p) => ({ ...p, variantGroupId: e.target.value }))}
                        />
                        <p className="text-xs text-muted-foreground">
                            Produk dengan grup varian yang sama akan ditampilkan bersama di POS
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Section E: Tampilan POS */}
            <Card className="mt-4">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Palette className="h-5 w-5" />
                        Tampilan POS
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                            <Label>Warna di POS</Label>
                            <div className="flex gap-2 items-center">
                                <input
                                    type="color"
                                    value={form.posColor || "#6366f1"}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, posColor: e.target.value }))
                                    }
                                    className="h-10 w-14 rounded border cursor-pointer"
                                />
                                <Input
                                    placeholder="#FF5722"
                                    value={form.posColor}
                                    onChange={(e) =>
                                        setForm((p) => ({ ...p, posColor: e.target.value }))
                                    }
                                    className="flex-1"
                                />
                                {form.posColor && (
                                    <button
                                        type="button"
                                        onClick={() => setForm((p) => ({ ...p, posColor: "" }))}
                                        className="text-muted-foreground hover:text-foreground"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Image Upload */}
                    <div className="space-y-3 p-4 rounded-lg border bg-muted/20">
                        <Label className="text-sm font-semibold">Foto Menu (Opsional)</Label>
                        <p className="text-xs text-muted-foreground -mt-1">
                            Upload foto menu untuk ditampilkan di POS. Maks 1MB.
                        </p>
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/png,image/jpeg,image/jpg,image/webp"
                            className="hidden"
                            onChange={handleImageSelect}
                        />
                        {imagePreview ? (
                            <div className="relative w-40 h-28 rounded-lg overflow-hidden border-2 border-sky-200 shadow-sm">
                                <img
                                    src={imagePreview}
                                    alt="Preview"
                                    className="w-full h-full object-cover"
                                />
                                <button
                                    type="button"
                                    onClick={removeImage}
                                    className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 hover:bg-red-600 transition-colors shadow"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="w-40 h-28 rounded-lg border-2 border-dashed border-slate-300 hover:border-sky-400 transition-colors flex flex-col items-center justify-center text-slate-400 hover:text-sky-600"
                            >
                                <ImagePlus className="h-8 w-8 mb-1" />
                                <span className="text-xs font-medium">Upload Foto</span>
                            </button>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex gap-4 pt-6">
                <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <Save className="mr-2 h-4 w-4" />
                    )}
                    {isEdit ? "Simpan Perubahan" : "Tambah Menu"}
                </Button>
                <Button type="button" variant="outline" onClick={() => router.push(backHref)}>
                    Batal
                </Button>
            </div>
        </form>
    );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/forms/fb-menu-form.tsx
git commit -m "feat: create F&B menu form component with menu type toggle, tax settings, variant grouping, POS color"
```

---

## Task 5: Create F&B Add/Edit Pages and Update Product List Page

**Files:**
- Modify: `src/app/(protected)/cafe-lsp/produk/tambah/page.tsx` (replace re-export with F&B form)
- Create: `src/app/(protected)/cafe-lsp/produk/[id]/edit/page.tsx`
- Modify: `src/app/(protected)/resto/produk/tambah/page.tsx` (replace re-export with F&B form)
- Create: `src/app/(protected)/resto/produk/[id]/edit/page.tsx`
- Modify: `src/app/(protected)/cafe-lsp/produk/page.tsx` (replace re-export with F&B-aware product list)
- Modify: `src/app/(protected)/resto/produk/page.tsx` (same)

- [ ] **Step 1: Replace Cafe LSP tambah page**

Replace `src/app/(protected)/cafe-lsp/produk/tambah/page.tsx` with:

```tsx
"use client";

import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { useSession } from "next-auth/react";

export default function CafeLspTambahMenuPage() {
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "cafe_lsp";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Menu"
                description="Tambah menu baru ke daftar Cafe LSP"
                backHref="/cafe-lsp/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/cafe-lsp/produk" />
        </div>
    );
}
```

- [ ] **Step 2: Create Cafe LSP edit page**

Create `src/app/(protected)/cafe-lsp/produk/[id]/edit/page.tsx`:

```tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function CafeLspEditMenuPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "cafe_lsp";
    const [product, setProduct] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        fetch(`/api/toko/products/${id}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setProduct(json.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return <div className="text-center py-20 text-muted-foreground">Menu tidak ditemukan</div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Menu"
                description={`Mengedit: ${product.name}`}
                backHref="/cafe-lsp/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/cafe-lsp/produk" editProduct={product} />
        </div>
    );
}
```

- [ ] **Step 3: Replace Resto tambah page**

Replace `src/app/(protected)/resto/produk/tambah/page.tsx` with:

```tsx
"use client";

import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { useSession } from "next-auth/react";

export default function RestoTambahMenuPage() {
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "resto";

    return (
        <div className="space-y-6">
            <PageHeader
                title="Tambah Menu"
                description="Tambah menu baru ke daftar Resto"
                backHref="/resto/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/resto/produk" />
        </div>
    );
}
```

- [ ] **Step 4: Create Resto edit page**

Create `src/app/(protected)/resto/produk/[id]/edit/page.tsx`:

```tsx
"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/patterns/page-header";
import FbMenuForm from "@/components/forms/fb-menu-form";
import { Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";

export default function RestoEditMenuPage() {
    const { id } = useParams();
    const { data: session } = useSession();
    const unitType = (session?.user as any)?.unitType || "resto";
    const [product, setProduct] = React.useState<any>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
        if (!id) return;
        fetch(`/api/toko/products/${id}`)
            .then((r) => r.json())
            .then((json) => {
                if (json.data) setProduct(json.data);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="flex justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (!product) {
        return <div className="text-center py-20 text-muted-foreground">Menu tidak ditemukan</div>;
    }

    return (
        <div className="space-y-6">
            <PageHeader
                title="Edit Menu"
                description={`Mengedit: ${product.name}`}
                backHref="/resto/produk"
            />
            <FbMenuForm unitType={unitType} backHref="/resto/produk" editProduct={product} />
        </div>
    );
}
```

- [ ] **Step 5: Replace Cafe LSP product list page**

Replace `src/app/(protected)/cafe-lsp/produk/page.tsx` with an F&B-specific product list. This page shows products with F&B columns and links to the F&B edit page:

```tsx
"use client";

import TokoProdukPage from "@/app/(protected)/toko/produk/page";

export default function CafeLspProdukPage() {
    return <TokoProdukPage />;
}
```

**Wait** — the current Cafe LSP product list just re-exports the Toko page. Since the Toko product list page works fine for both (it's generic), keep the re-export pattern for now. The product list table will show F&B columns once the GET API returns them. No changes needed to the product list page at this stage.

- [ ] **Step 6: Commit**

```bash
git add "src/app/(protected)/cafe-lsp/produk/tambah/page.tsx" "src/app/(protected)/cafe-lsp/produk/[id]/edit/page.tsx" "src/app/(protected)/resto/produk/tambah/page.tsx" "src/app/(protected)/resto/produk/[id]/edit/page.tsx"
git commit -m "feat: create F&B add/edit pages for Cafe LSP and Resto using fb-menu-form component"
```

---

## Task 6: Update F&B POS Pages (Category Tabs, Color Cards, Variant Grouping)

**Files:**
- Modify: `src/app/(protected)/cafe-lsp/kasir/page.tsx`
- Modify: `src/app/(protected)/resto/kasir/page.tsx`

This task modifies both F&B POS pages to: (1) fetch categories from `StoreCategory`, (2) apply `posColor` to product cards, (3) show "86'd" badge for unavailable kitchen items, and (4) group variants.

- [ ] **Step 1: Update Cafe LSP POS — fetch categories from StoreCategory API**

In `src/app/(protected)/cafe-lsp/kasir/page.tsx`:

**A)** Update the `Product` interface (line 19) to include F&B fields:

```typescript
interface Product {
    id: number;
    sku: string;
    name: string;
    price: number;
    isService: boolean;
    category?: string;
    imageUrl?: string | null;
    stock?: number;
    // F&B fields
    categoryId?: number | null;
    menuType?: string | null;
    posColor?: string | null;
    variantGroupId?: string | null;
    isActive?: boolean;
}
```

**B)** Replace the category fetch logic. Currently categories are derived from product data client-side (line 242-246). Change to fetch from StoreCategory API:

Find the `categories` useMemo (around line 242-246):
```typescript
    const categories = React.useMemo(() => {
        const cats = new Set<string>();
        products.forEach(p => { if (p.category) cats.add(p.category); });
        return ["★ Quick", "Semua", ...Array.from(cats).sort()];
    }, [products]);
```

Replace with:
```typescript
    const [fbCategories, setFbCategories] = React.useState<{id: number; name: string; sortOrder: number}[]>([]);

    React.useEffect(() => {
        fetch("/api/toko/products/categories?unitType=cafe_lsp")
            .then(r => r.json())
            .then(data => {
                if (data.data) setFbCategories(data.data);
            })
            .catch(() => {});
    }, []);

    const categories = React.useMemo(() => {
        return ["★ Quick", "Semua", ...fbCategories.map(c => c.name)];
    }, [fbCategories]);
```

**C)** Update the filter logic in `filteredMenu` (around line 248-255). Change:
```typescript
const matchCategory = activeCategory === "Semua" || p.category === activeCategory;
```
to:
```typescript
const matchCategory = activeCategory === "Semua" || p.category === activeCategory ||
    (fbCategories.find(c => c.name === activeCategory)?.id === p.categoryId);
```

**D)** Find the product card/button rendering in the POS grid. Add `posColor` styling and "86'd" badge. Search for where product buttons are rendered (the grid with product cards). Add to each product button/card:

For color:
```typescript
style={p.posColor ? { backgroundColor: p.posColor + '20', borderColor: p.posColor } : undefined}
```

For 86'd badge, add inside the card:
```typescript
{p.menuType === "kitchen" && !p.isActive && (
    <span className="absolute top-1 right-1 bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded font-bold">
        86'd
    </span>
)}
```

**E)** Add variant grouping display. Group products by `variantGroupId` when rendering. Before the main product grid, add a useMemo for grouped variants:

```typescript
    const variantGroups = React.useMemo(() => {
        const groups = new Map<string, Product[]>();
        const ungrouped: Product[] = [];
        for (const p of filteredMenu) {
            if (p.variantGroupId) {
                const existing = groups.get(p.variantGroupId) || [];
                existing.push(p);
                groups.set(p.variantGroupId, existing);
            } else {
                ungrouped.push(p);
            }
        }
        return { groups, ungrouped };
    }, [filteredMenu]);
```

Then in the grid rendering, show variant groups as a parent card with size buttons, and ungrouped items as normal cards.

- [ ] **Step 2: Apply same changes to Resto POS page**

In `src/app/(protected)/resto/kasir/page.tsx`, apply the exact same changes (A-E above) but with `unitType=resto` for the category fetch.

- [ ] **Step 3: Commit**

```bash
git add "src/app/(protected)/cafe-lsp/kasir/page.tsx" "src/app/(protected)/resto/kasir/page.tsx"
git commit -m "feat: update F&B POS with StoreCategory tabs, color cards, variant grouping, and 86'd badges"
```

---

## Task 7: Tax Calculation Guard in Sales Route

**Files:**
- Modify: `src/app/api/toko/sales/route.ts` (add exclusive tax calculation for F&B)
- Modify: `src/app/api/toko/split-bill/route.ts` (same tax calculation)

This task adds tax calculation for F&B products with `taxType === "exclusive"`. This code is guarded by `isFbUnit()` + `taxType` check, so Toko is never affected.

- [ ] **Step 1: Add import to sales route**

At the top of `src/app/api/toko/sales/route.ts`, add the import:

```typescript
import { isFbUnit } from "@/lib/constants/units";
```

- [ ] **Step 2: Add tax calculation in the item validation loop**

In the sales route, after `const unitPrice = rawPrice - discount;` (around line 302), add:

```typescript
                // F&B exclusive tax: add tax on top of unit price
                let taxAmount = 0;
                if (isFbUnit(unitType) && product.taxType === "exclusive" && Number(product.taxRate) > 0) {
                    taxAmount = Math.round(unitPrice * Number(product.taxRate) / 100);
                }
                const totalUnitPrice = unitPrice + taxAmount;
                const subtotal = totalUnitPrice * item.quantity;
                totalAmount += subtotal;

                validatedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unitPrice: totalUnitPrice,
                    subtotal,
                    discount,
                    costPrice: Number(product.costPrice) || 0,
                    taxAmount,
                });
```

This replaces the existing lines:
```typescript
                const unitPrice = rawPrice - discount;
                const subtotal = unitPrice * item.quantity;
                totalAmount += subtotal;

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, discount, costPrice: Number(product.costPrice) || 0 });
```

The `taxAmount` field in `validatedItems` is optional — existing code that doesn't set it will have `undefined`, which is falsy = 0 tax. This is backward-compatible.

- [ ] **Step 3: Add import to split-bill route**

At the top of `src/app/api/toko/split-bill/route.ts`, add:

```typescript
import { isFbUnit } from "@/lib/constants/units";
```

- [ ] **Step 4: Add same tax calculation in split-bill route**

In the split-bill route, find the equivalent price calculation section (around line 121-132). Apply the same pattern:

Replace:
```typescript
                const unitPrice = rawPrice - discount;
                const subtotal = unitPrice * item.quantity;
                orderTotal += subtotal;

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, discount, costPrice: Number(product.costPrice) || 0 });
```

With:
```typescript
                let taxAmount = 0;
                if (isFbUnit(unitTypeVal) && product.taxType === "exclusive" && Number(product.taxRate) > 0) {
                    taxAmount = Math.round(unitPrice * Number(product.taxRate) / 100);
                }
                const totalUnitPrice = unitPrice + taxAmount;
                const subtotal = totalUnitPrice * item.quantity;
                orderTotal += subtotal;

                validatedItems.push({
                    productId: product.id,
                    quantity: item.quantity,
                    unitPrice: totalUnitPrice,
                    subtotal,
                    discount,
                    costPrice: Number(product.costPrice) || 0,
                    taxAmount,
                });
```

- [ ] **Step 5: Commit**

```bash
git add src/app/api/toko/sales/route.ts src/app/api/toko/split-bill/route.ts
git commit -m "feat: add exclusive tax calculation for F&B products in sales and split-bill routes"
```

---

## Task 8: Run Migration on Production and Verify

**Files:** None (production operations)

- [ ] **Step 1: Push code to remote**

```bash
git push origin railway-migration
```

- [ ] **Step 2: Wait for Railway deployment to complete**

Run: Check Railway dashboard or use `railway status`
Expected: Deployment successful

- [ ] **Step 3: Run migration endpoint on production**

```bash
curl -X POST https://www.primkoppol.site/api/admin/migrate -H "Cookie: <session-cookie>"
```

Expected: All columns and table created successfully

- [ ] **Step 4: Test F&B product creation via Cafe LSP form**

1. Open `https://www.primkoppol.site/cafe-lsp/produk/tambah`
2. Fill in: Nama Menu = "Test Kopi Latte", Kategori = new category "Kopi", HPP = 10000, Harga Jual = 25000
3. Select "Menu Dapur" type
4. Submit
5. Verify product appears in product list with correct fields

- [ ] **Step 5: Test Toko product creation is unchanged**

1. Open `https://www.primkoppol.site/toko/produk/tambah`
2. Add a normal product with stock
3. Submit
4. Verify `trackStock = true`, stock deducted on sale
5. Verify no F&B fields are shown or required

- [ ] **Step 6: Test F&B POS category tabs**

1. Open `https://www.primkoppol.site/cafe-lsp/kasir`
2. Verify category tabs appear from StoreCategory
3. Click a category tab — verify filtering works
4. Verify color-coded product cards appear
5. Verify "86'd" badge shows for inactive kitchen items

- [ ] **Step 7: Test Toko sale still deducts stock correctly**

1. Open `https://www.primkoppol.site/toko/kasir`
2. Add a product to cart
3. Complete checkout
4. Verify stock decreased correctly
5. Verify no tax calculation added (taxType = "inclusive" default)
