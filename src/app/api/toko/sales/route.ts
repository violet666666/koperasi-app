import { NextResponse } from "next/server";
import prisma, { prismaRead } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";
import { isFbUnit, storeSaleUnitTypeFilter } from "@/lib/constants/units";
import { findUnitAccount } from "@/lib/cash-bank";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { createNotification, getNotificationRecipients } from "@/lib/notifications";
import { getPlafonPiutang } from "@/lib/plafon";

const ALLOWED_SALES_ROLES = ["admin", "operator", "kasir"];

// GET /api/toko/sales - List sales with items (server-side pagination + filters)
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!ALLOWED_SALES_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const userUnitType = (session.user as { unitType?: string }).unitType || null;
        const unitType = searchParams.get("unitType") || userUnitType || null;
        // Non-operator users can only see their own unit
        if (role !== "operator" && userUnitType && unitType && !isSameUnit(unitType, userUnitType)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));
        const search = searchParams.get("search")?.trim() || null;
        const paymentMethods = searchParams.get("paymentMethods")?.split(",").filter(Boolean) || null;
        const showVoided = searchParams.get("showVoided") !== "false"; // default true
        const shiftId = searchParams.get("shiftId") || null;
        const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
        const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

        // Build where clause
        const where: Record<string, unknown> = {
            ...(unitType && { unitType: storeSaleUnitTypeFilter(unitType) }),
        };

        if (fromDate || toDate) {
            const dateFilter: Record<string, unknown> = {};
            if (fromDate) dateFilter.gte = fromDate;
            if (toDate) dateFilter.lte = toDate;
            where.createdAt = dateFilter;
        }

        // Filter voided sales
        if (!showVoided) {
            where.NOT = { metadata: { path: ["isVoided"], equals: true } };
        }

        // Filter by payment methods
        if (paymentMethods && paymentMethods.length > 0) {
            where.paymentMethod = { in: paymentMethods };
        }

        // Filter by shift
        if (shiftId && shiftId !== "all") {
            if (shiftId === "none") {
                where.shiftId = null;
            } else {
                where.shiftId = Number(shiftId);
            }
        }

        // Search filter — apply at DB level where possible, narrow with JS for item-level search
        if (search) {
            const lowered = search.toLowerCase();
            where.OR = [
                { saleNo: { contains: lowered, mode: "insensitive" } },
                { customerName: { contains: lowered, mode: "insensitive" } },
                { member: { name: { contains: lowered, mode: "insensitive" } } },
                { createdBy: { name: { contains: lowered, mode: "insensitive" } } },
                { cashierIdentity: { displayName: { contains: lowered, mode: "insensitive" } } },
                { items: { some: { product: { name: { contains: lowered, mode: "insensitive" } } } } },
            ];
        }

        const salesQuery = {
            where: where as any,
            include: {
                items: {
                    include: { product: { select: { id: true, sku: true, name: true } } },
                },
                createdBy: { select: { id: true, name: true } },
                member: { select: { id: true, name: true, memberNo: true } },
                shift: { select: { id: true, shiftName: true, status: true } },
                cashierIdentity: { select: { id: true, displayName: true } },
            },
            orderBy: { [sortBy]: sortOrder } as any,
            skip: (page - 1) * perPage,
            take: perPage,
        };
        let sales: any[];
        let total: number;
        try {
            [sales, total] = await Promise.all([
                prismaRead.storeSale.findMany(salesQuery),
                prismaRead.storeSale.count({ where: where as any }),
            ]);
        } catch (readError) {
            console.warn("[Sales GET] prismaRead failed, falling back to TCP:", readError instanceof Error ? readError.message : readError);
            [sales, total] = await Promise.all([
                prisma.storeSale.findMany(salesQuery),
                prisma.storeSale.count({ where: where as any }),
            ]);
        }

        const totalPages = Math.max(1, Math.ceil(total / perPage));

        return NextResponse.json({
            data: sales.map((s: any) => ({
                id: s.id,
                saleNo: s.saleNo,
                customerName: s.customerName,
                member: s.member,
                totalAmount: Number(s.totalAmount),
                paymentMethod: s.paymentMethod,
                cashReceived: s.cashReceived ? Number(s.cashReceived) : null,
                changeAmount: s.changeAmount ? Number(s.changeAmount) : null,
                createdAt: s.createdAt.toISOString(),
                createdBy: s.createdBy,
                cashierDisplayName: s.cashierIdentity?.displayName || null,
                metadata: s.metadata,
                shiftId: s.shiftId,
                shift: s.shift ? { id: s.shift.id, shiftName: s.shift.shiftName, status: s.shift.status } : null,
                items: s.items.map((i: any) => ({
                    id: i.id,
                    productId: i.productId,
                    product: i.product,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    subtotal: Number(i.subtotal),
                })),
            })),
            pagination: {
                page,
                perPage,
                total,
                totalPages,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/sales error:", error);
        return NextResponse.json({ message: "Failed to fetch sales" }, { status: 500 });
    }
}

// POST /api/toko/sales - Process a toko sale (checkout)
// Validation, sale creation, and stock deduction run inside a single $transaction
// to prevent race conditions and partial failures.
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!ALLOWED_SALES_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { items, customerName, paymentMethod, cashReceived, memberId, unitType: reqUnitType, metadata, shiftId: reqShiftId, cashierIdentityId, shiftUnitType } = body;
        const unitType = reqUnitType || "toko";
        const shiftUnit = shiftUnitType || unitType;
        const salePrefixMap: Record<string, string> = { toko: "TK", playstation: "PS", cafe_lsp: "CF", resto_cafe: "RC", resto: "RS", coffe_latar: "CL" };
        const unitPrefix = salePrefixMap[unitType] || "TK";

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang kosong" }, { status: 400 });
        }

        // Server-side validation: reject negative/zero quantities
        for (const item of items) {
            const qty = Number(item.quantity);
            if (!qty || qty <= 0 || isNaN(qty)) {
                return NextResponse.json({ message: "Jumlah item harus lebih dari 0" }, { status: 400 });
            }
        }

        const userId = Number(session.user.id);

        // Validate cashierIdentityId ownership before entering transaction
        if (cashierIdentityId) {
            const identity = await prisma.cashierIdentity.findFirst({
                where: { id: Number(cashierIdentityId), parentUserId: userId, isActive: true },
            });
            if (!identity) {
                return NextResponse.json({ message: "Identitas kasir tidak valid" }, { status: 403 });
            }
        }

        // Pre-transaction validations (reads that don't need locking)
        const method = paymentMethod || "cash";
        let payment = cashReceived || 0;
        let changeAmount = 0;

        // Validate member for salary_cut
        let preValidatedMember: any = null;
        if (method === "salary_cut") {
            if (!memberId) {
                return NextResponse.json({ message: "Member ID diperlukan untuk pembayaran potong gaji" }, { status: 400 });
            }
            preValidatedMember = await prisma.member.findUnique({ where: { id: memberId } });
            if (!preValidatedMember) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }
        }

        // Lookup accounts outside transaction (read-only, static data)
        const [currentPeriod, kasAccount, piutangTokoAccount, tokoIncomeAccount, headOffice] = await Promise.all([
            prisma.fiscalPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } }),
            prisma.account.findFirst({ where: { code: "1101" } }),
            prisma.account.findFirst({ where: { code: "1301" } }),
            prisma.account.findFirst({ where: { code: "4201" } }),
            prisma.branch.findFirst({ where: { isHeadOffice: true } }),
        ]);

        // Run everything critical inside an interactive transaction
        const result = await prisma.$transaction(async (tx) => {
            // Auto-detect shift
            let shiftId: number | null = reqShiftId ? Number(reqShiftId) : null;
            if (!shiftId) {
                const openShift = await tx.cashierShift.findFirst({
                    where: { userId, status: "open", unitType: shiftUnit },
                });
                shiftId = openShift?.id || null;
            } else {
                // Validate provided shift belongs to same unit
                const shift = await tx.cashierShift.findUnique({ where: { id: shiftId } });
                if (!shift || shift.status !== "open") {
                    throw new Error("Shift tidak valid atau sudah ditutup");
                }
                if (shift.unitType !== shiftUnit) {
                    throw new Error("Shift tidak sesuai dengan unit");
                }
            }

            // Batch fetch all products at once instead of N individual lookups
            let totalAmount = 0;
            const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; discount: number; costPrice: number }[] = [];

            const productIds = items.map((item: any) => item.productId);
            const productRows = await tx.storeProduct.findMany({ where: { id: { in: productIds } } });
            const productMap = new Map(productRows.map(p => [p.id, p]));

            for (const item of items) {
                const product = productMap.get(item.productId);
                if (!product) {
                    throw new Error(`Produk ID ${item.productId} tidak ditemukan`);
                }
                if (!product.isActive || product.deletedAt) {
                    throw new Error(`Produk "${product.name}" tidak aktif atau sudah dihapus`);
                }
                if (product.unitType !== unitType) {
                    throw new Error(`Produk "${product.name}" bukan milik unit ${unitType}`);
                }

                // Hybrid stock check: racikan products check ingredient stock, retail checks product stock
                const nonInventoryUnits = ["cafe_lsp", "resto", "resto_cafe", "coffe_latar"];
                const isRacikan = product.trackStock === false || nonInventoryUnits.includes(product.unitType || "");
                if (!product.isService) {
                    if (isRacikan) {
                        // Check ingredient stock for racikan products
                        const recipes = await tx.productRecipe.findMany({
                            where: { productId: product.id, ingredientProductId: { not: null } },
                        });
                        for (const recipe of recipes) {
                            const ingredient = await tx.storeProduct.findUnique({
                                where: { id: recipe.ingredientProductId! },
                            });
                            if (!ingredient) continue;
                            const needed = Math.ceil(Number(recipe.quantity) * item.quantity);
                            const available = ingredient.stock + ingredient.stockGdg;
                            if (available < needed) {
                                throw new Error(`Bahan baku ${ingredient.name} tidak mencukupi untuk ${product.name} (sisa: ${available}, dibutuhkan: ${needed})`);
                            }
                        }
                    } else {
                        const effectiveStock = product.stockToko + product.stockGdg;
                        if (effectiveStock < item.quantity) {
                            throw new Error(`Stok ${product.name} tidak mencukupi (sisa: ${effectiveStock})`);
                        }
                    }
                }

                const rawPrice = Number(product.sellPrice);
                let discount = 0;
                if (product.discountType === "percent" && Number(product.discountValue) > 0) {
                    discount = Math.round(rawPrice * Number(product.discountValue) / 100);
                } else if (product.discountType === "fixed" && Number(product.discountValue) > 0) {
                    discount = Math.min(Number(product.discountValue), rawPrice);
                }

                // Add modifier price adjustment from client
                const modifierTotal = Number(item.modifierTotal) || 0;
                const unitPrice = rawPrice - discount + modifierTotal;

                // F&B exclusive tax: add tax on top of unit price (base after discount, before modifier)
                let taxAmount = 0;
                if (isFbUnit(unitType) && product.taxType === "exclusive" && Number(product.taxRate) > 0) {
                    const taxableBase = rawPrice - discount;
                    taxAmount = Math.round(taxableBase * Number(product.taxRate) / 100);
                }
                const totalUnitPrice = unitPrice + taxAmount;
                const subtotal = totalUnitPrice * item.quantity;
                totalAmount += subtotal;

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice: totalUnitPrice, subtotal, discount, costPrice: Number(product.costPrice) || 0, taxAmount });
            }

            // Validate payment
            if (method === "cash") {
                if ((cashReceived || 0) < totalAmount) {
                    throw new Error("Pembayaran kurang");
                }
                payment = cashReceived || totalAmount;
                changeAmount = payment - totalAmount;
            } else if (method === "salary_cut") {
                // Validate credit limit — use pre-validated member + lightweight check
                const tagihanUnitTx = await tx.unitTransaction.aggregate({
                    where: {
                        memberId: memberId,
                        paymentMethod: "salary_cut",
                        isPaid: false,
                        status: { in: ["completed", "pending_void"] },
                    },
                    _sum: { amount: true },
                });
                const totalTagihan = Number(tagihanUnitTx._sum.amount || 0);
                const plafonPiutang = getPlafonPiutang(preValidatedMember);

                const sisaLimit = plafonPiutang - totalTagihan;
                if (totalAmount > sisaLimit) {
                    throw new Error(`Transaksi ditolak: Sisa limit piutang Rp ${sisaLimit.toLocaleString("id-ID")} tidak cukup untuk belanja Rp ${totalAmount.toLocaleString("id-ID")}. Plafon: Rp ${plafonPiutang.toLocaleString("id-ID")}, Tagihan aktif: Rp ${totalTagihan.toLocaleString("id-ID")}.`);
                }

                payment = 0;
                changeAmount = 0;
            } else if (method === "qris") {
                payment = totalAmount;
                changeAmount = 0;
            }

            // Generate sequential sale number: TK-DDMMYYYY-0001 (with retry for concurrency)
            const now = new Date();
            const datePart = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
            const saleNoPrefix = `${unitPrefix}-${datePart}-`;
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayCount = await tx.storeSale.count({
                where: { createdAt: { gte: startOfDay }, unitType },
            });
            let saleNo = "";
            for (let attempt = todayCount + 1; attempt < todayCount + 100; attempt++) {
                const candidate = saleNoPrefix + String(attempt).padStart(4, "0");
                const exists = await tx.storeSale.findUnique({ where: { saleNo: candidate } });
                if (!exists) { saleNo = candidate; break; }
            }
            if (!saleNo) {
                saleNo = saleNoPrefix + String(todayCount + 1).padStart(4, "0");
            }

            // Create journal (inside transaction for atomicity)
            let journalId: number | null = null;
            try {
                if (tokoIncomeAccount && headOffice && currentPeriod) {
                    const debitAccountId = method === "salary_cut"
                        ? (piutangTokoAccount?.id || kasAccount?.id)
                        : kasAccount?.id;

                    if (debitAccountId) {
                        const journalNo = `JRN-${Date.now().toString(36).toUpperCase()}`;
                        const journal = await tx.journal.create({
                            data: {
                                journalNo,
                                branchId: headOffice.id,
                                transactionDate: now,
                                description: `Penjualan ${unitType} ${method === "salary_cut" ? "(Potong Gaji)" : (method === "qris" ? "(QRIS)" : "(Tunai)")} - ${saleNo}`,
                                sourceType: "store_sale",
                                periodId: currentPeriod.id,
                                isPosted: true,
                                createdById: userId,
                            },
                        });

                        await tx.journalLine.createMany({
                            data: [
                                {
                                    journalId: journal.id,
                                    accountId: debitAccountId,
                                    debit: totalAmount,
                                    credit: 0,
                                    description: method === "salary_cut"
                                        ? `Piutang ${unitType} (potong gaji)`
                                        : `Kas masuk penjualan ${unitType}`,
                                },
                                {
                                    journalId: journal.id,
                                    accountId: tokoIncomeAccount.id,
                                    debit: 0,
                                    credit: totalAmount,
                                    description: "Pendapatan toko",
                                },
                            ],
                        });

                        journalId = journal.id;
                    }
                }
            } catch (journalErr) {
                console.error("[Toko Sales] Journal creation failed (non-fatal):", journalErr);
            }

            // Create sale record
            const sale = await tx.storeSale.create({
                data: {
                    saleNo,
                    memberId: memberId ? Number(memberId) : null,
                    unitType,
                    customerName: customerName || null,
                    totalAmount,
                    paymentMethod: method,
                    cashReceived: (method === "cash" || method === "qris") ? payment : 0,
                    changeAmount,
                    metadata: metadata ? metadata : null,
                    journalId,
                    periodId: currentPeriod?.id || null,
                    shiftId,
                    cashierIdentityId: cashierIdentityId ? Number(cashierIdentityId) : null,
                    createdById: userId,
                    items: {
                        create: validatedItems.map((vi) => ({
                            productId: vi.productId,
                            quantity: vi.quantity,
                            unitPrice: vi.unitPrice,
                            discount: vi.discount,
                            subtotal: vi.subtotal,
                            costPrice: vi.costPrice || null,
                        })),
                    },
                },
                include: { items: { include: { product: true } } },
            });

            // Deduct stock — batched operations to minimize DB round-trips
            const allBatches = await tx.stockBatch.findMany({
                where: { productId: { in: productIds }, isActive: true, quantity: { gt: 0 }, unitType },
                orderBy: { receivedAt: "asc" },
            });
            const batchesByProduct = new Map<number, typeof allBatches>();
            for (const b of allBatches) {
                if (!batchesByProduct.has(b.productId)) batchesByProduct.set(b.productId, []);
                batchesByProduct.get(b.productId)!.push(b);
            }

            // Compute all new stock values in-memory first (no DB calls in loop)
            const runningStock = new Map(productRows.map(p => [p.id, { toko: Number(p.stockToko), gdg: Number(p.stockGdg) }]));
            const stockMovements: any[] = [];
            const batchUpdates: { id: number; newQty: number }[] = [];

            // Track ingredient deductions for racikan products
            const ingredientDeductions = new Map<number, number>(); // ingredientId -> total deduct
            const ingredientMovements: any[] = [];
            const ingredientBatchUpdates: { id: number; newQty: number }[] = [];

            for (const vi of validatedItems) {
                const prod = productMap.get(vi.productId);
                if (!prod || prod.isService) continue;

                const isRacikan = prod.trackStock === false;

                if (isRacikan) {
                    // Racikan: deduct ingredient stock instead of product stock
                    const recipes = await tx.productRecipe.findMany({
                        where: { productId: prod.id, ingredientProductId: { not: null } },
                    });

                    // Fetch all needed ingredient batches for FIFO
                    const ingredientIds = recipes.map(r => r.ingredientProductId!).filter(Boolean);
                    if (ingredientIds.length > 0) {
                        const ingBatches = await tx.stockBatch.findMany({
                            where: { productId: { in: ingredientIds }, isActive: true, quantity: { gt: 0 }, unitType },
                            orderBy: { receivedAt: "asc" },
                        });
                        const ingBatchesByProduct = new Map<number, typeof ingBatches>();
                        for (const ib of ingBatches) {
                            if (!ingBatchesByProduct.has(ib.productId)) ingBatchesByProduct.set(ib.productId, []);
                            ingBatchesByProduct.get(ib.productId)!.push(ib);
                        }

                        for (const recipe of recipes) {
                            if (!recipe.ingredientProductId) continue;
                            const needed = Math.ceil(Number(recipe.quantity) * vi.quantity);

                            // Accumulate deduction per ingredient
                            ingredientDeductions.set(
                                recipe.ingredientProductId,
                                (ingredientDeductions.get(recipe.ingredientProductId) || 0) + needed
                            );

                            // FIFO batch deduction for ingredient
                            let remaining = needed;
                            const ingBatchesList = ingBatchesByProduct.get(recipe.ingredientProductId) || [];
                            for (const ib of ingBatchesList) {
                                if (remaining <= 0) break;
                                const deduct = Math.min(ib.quantity, remaining);
                                const newQty = ib.quantity - deduct;
                                ingredientBatchUpdates.push({ id: ib.id, newQty });
                                ib.quantity = newQty;
                                remaining -= deduct;
                            }
                        }
                    }
                } else {
                    // Retail: deduct product stock (existing behavior)
                    const stock = runningStock.get(vi.productId)!;
                    let newStockToko = stock.toko;
                    let newStockGdg = stock.gdg;

                    if (stock.toko >= vi.quantity) {
                        newStockToko = stock.toko - vi.quantity;
                    } else {
                        const sisaFromToko = stock.toko;
                        const kurangDariGdg = vi.quantity - sisaFromToko;
                        newStockToko = 0;
                        newStockGdg = Math.max(0, stock.gdg - kurangDariGdg);
                    }

                    runningStock.set(vi.productId, { toko: newStockToko, gdg: newStockGdg });

                    stockMovements.push({
                        productId: vi.productId,
                        type: "out",
                        quantity: vi.quantity,
                        reference: `Penjualan ${saleNo}`,
                        notes: `Terjual (${method})`,
                        operatorId: userId,
                        costAtTime: vi.costPrice,
                        reason: "sale",
                    });

                    // FIFO batch deduction — compute in-memory, apply batch update later
                    let remainingToDeduct = vi.quantity;
                    const batches = batchesByProduct.get(vi.productId) || [];
                    for (const batch of batches) {
                        if (remainingToDeduct <= 0) break;
                        const deduct = Math.min(batch.quantity, remainingToDeduct);
                        const newQty = batch.quantity - deduct;
                        batchUpdates.push({ id: batch.id, newQty });
                        batch.quantity = newQty;
                        remainingToDeduct -= deduct;
                    }
                }
            }

            // Process ingredient stock deductions for racikan items
            if (ingredientDeductions.size > 0) {
                const ingredientIds = [...ingredientDeductions.keys()];
                const ingredientProducts = await tx.storeProduct.findMany({
                    where: { id: { in: ingredientIds } },
                });
                const ingStockMap = new Map(ingredientProducts.map(ip => [ip.id, { gdg: Number(ip.stockGdg), stock: Number(ip.stock) }]));

                for (const [ingId, deductQty] of ingredientDeductions) {
                    const ingStock = ingStockMap.get(ingId);
                    if (!ingStock) continue;
                    const newGdg = Math.max(0, ingStock.gdg - deductQty);
                    const newStock = Math.max(0, ingStock.stock - deductQty);
                    ingStockMap.set(ingId, { gdg: newGdg, stock: newStock });

                    ingredientMovements.push({
                        productId: ingId,
                        type: "out",
                        quantity: deductQty,
                        reference: `Produksi ${saleNo}`,
                        notes: `Digunakan untuk racikan`,
                        operatorId: userId,
                        reason: "production",
                    });
                }

                // Update ingredient product stocks
                const ingStockCases = Array.from(ingStockMap.entries())
                    .map(([id, s]) => `WHEN ${id} THEN ${s.stock}`)
                    .join(" ");
                const ingGdgCases = Array.from(ingStockMap.entries())
                    .map(([id, s]) => `WHEN ${id} THEN ${s.gdg}`)
                    .join(" ");
                const ingTokoCases = Array.from(ingStockMap.entries())
                    .map(([id]) => `WHEN ${id} THEN 0`)
                    .join(" ");
                const ingIdsStr = ingredientIds.join(",");

                await tx.$executeRawUnsafe(`
                    UPDATE store_products
                    SET stock = CASE id ${ingStockCases} END,
                        stock_toko = CASE id ${ingTokoCases} END,
                        stock_gdg = CASE id ${ingGdgCases} END
                    WHERE id IN (${ingIdsStr})
                `);

                // Update ingredient batch quantities
                if (ingredientBatchUpdates.length > 0) {
                    const ingQtyCases = ingredientBatchUpdates.map(b => `WHEN ${b.id} THEN ${b.newQty}`).join(" ");
                    const ingActiveCases = ingredientBatchUpdates.map(b => `WHEN ${b.id} THEN ${b.newQty > 0}`).join(" ");
                    const ingBatchIds = ingredientBatchUpdates.map(b => b.id).join(",");

                    await tx.$executeRawUnsafe(`
                        UPDATE stock_batches
                        SET quantity = CASE id ${ingQtyCases} END,
                            is_active = CASE id ${ingActiveCases} END
                        WHERE id IN (${ingBatchIds})
                    `);
                }

                // Insert ingredient stock movements
                if (ingredientMovements.length > 0) {
                    await tx.storeStockMovement.createMany({ data: ingredientMovements });
                }
            }

            // Batch 1: Update all product stocks with a single raw SQL statement
            if (stockMovements.length > 0) {
                const productStockCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.toko + s.gdg}`)
                    .join(" ");
                const tokoCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.toko}`)
                    .join(" ");
                const gdgCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.gdg}`)
                    .join(" ");
                const productIdsToUpdate = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id]) => id)
                    .join(",");

                await tx.$executeRawUnsafe(`
                    UPDATE store_products
                    SET stock = CASE id ${productStockCases} END,
                        stock_toko = CASE id ${tokoCases} END,
                        stock_gdg = CASE id ${gdgCases} END
                    WHERE id IN (${productIdsToUpdate})
                `);

                // Batch 2: Update all stock batches with a single raw SQL statement
                if (batchUpdates.length > 0) {
                    const qtyCases = batchUpdates.map(b => `WHEN ${b.id} THEN ${b.newQty}`).join(" ");
                    const activeCases = batchUpdates.map(b => `WHEN ${b.id} THEN ${b.newQty > 0}`).join(" ");
                    const batchIds = batchUpdates.map(b => b.id).join(",");

                    await tx.$executeRawUnsafe(`
                        UPDATE stock_batches
                        SET quantity = CASE id ${qtyCases} END,
                            is_active = CASE id ${activeCases} END
                        WHERE id IN (${batchIds})
                    `);
                }

                // Batch 3: Create all stock movements in one statement
                await tx.storeStockMovement.createMany({ data: stockMovements });
            }

            // Update cash/bank account (atomic increment inside transaction)
            if (method === "cash" || method === "qris") {
                const accountType = method === "cash" ? "cash" : "bank";
                const targetAccount = await findUnitAccount(tx, unitType, accountType);

                if (targetAccount) {
                    const updatedAccount = await tx.cashBankAccount.update({
                        where: { id: targetAccount.id },
                        data: { currentBalance: { increment: totalAmount } },
                    });
                    const balanceBefore = Number(updatedAccount.currentBalance) - totalAmount;

                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `${unitPrefix}-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                            accountId: targetAccount.id,
                            branchId: targetAccount.branchId,
                            type: "in",
                            category: "pendapatan_toko",
                            amount: totalAmount,
                            balanceBefore,
                            balanceAfter: Number(updatedAccount.currentBalance),
                            unitType: unitType,
                            description: `Penjualan ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${saleNo}`,
                            transactionDate: now,
                            createdById: userId,
                        },
                    });
                }
            }

            // Create piutang for salary_cut (inside transaction)
            if (method === "salary_cut" && memberId) {
                await tx.unitTransaction.create({
                    data: {
                        transactionNo: `${unitPrefix}-UTG-${Date.now().toString(36).toUpperCase()}`,
                        memberId: memberId,
                        unitType: unitType,
                        description: `Piutang ${unitType} (Potongan Gaji) - ${saleNo}`,
                        amount: totalAmount,
                        transactionDate: now,
                        paymentMethod: "salary_cut",
                        isPaid: false,
                        notes: `Auto-generated dari penjualan kasir. No. Transaksi: ${saleNo}`,
                        createdById: userId,
                    },
                });
            }

            return { sale, totalAmount: Number(sale.totalAmount), saleNo: sale.saleNo, deductedIngredientIds: [...ingredientDeductions.keys()] };
        }, {
            maxWait: 15000,
            timeout: 60000,
        });

        // Audit log (outside transaction — non-critical)
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Toko", unitType,
                description: `Penjualan ${method}: ${result.saleNo} - Rp ${result.totalAmount.toLocaleString()}`,
                targetId: String(result.sale.id), targetType: "StoreSale",
                newData: { saleNo: result.saleNo, totalAmount: result.totalAmount, paymentMethod: method, memberId: body.memberId || null, unitType },
            });
        } catch (e) { /* audit log failure must not break response */ }

        // Low stock notification (fire-and-forget)
        try {
            const soldProductIds = result.sale.items?.map((item: any) => item.productId) || [];
            const soldProducts = await prisma.storeProduct.findMany({
                where: { id: { in: soldProductIds }, minStock: { gt: 0 } },
                select: { id: true, name: true, stockToko: true, minStock: true, unitType: true },
            });
            const lowStockProducts = soldProducts.filter((p) => p.stockToko <= p.minStock);
            if (lowStockProducts.length > 0) {
                const uniqueUnits = [...new Set(lowStockProducts.map((p) => p.unitType))];
                for (const prodUnitType of uniqueUnits) {
                    const adminIds = await getNotificationRecipients(prodUnitType);
                    if (adminIds.length > 0) {
                        const unitProducts = lowStockProducts.filter((p) => p.unitType === prodUnitType);
                        for (const prod of unitProducts) {
                            await createNotification({
                                userId: adminIds,
                                type: "low_stock",
                                title: "Stok Rendah",
                                message: `${prod.name}: sisa ${prod.stockToko} ${prod.minStock ? `(min: ${prod.minStock})` : ""}`,
                                data: { productId: prod.id, unitType: prod.unitType },
                            });
                        }
                    }
                }
            }

            // Ingredient low stock alerts for racikan products
            const deductedIngredientIds = (result as any).deductedIngredientIds as number[] | undefined;
            if (deductedIngredientIds && deductedIngredientIds.length > 0) {
                const ingredients = await prisma.storeProduct.findMany({
                    where: { id: { in: deductedIngredientIds }, minStock: { gt: 0 }, productType: "ingredient" },
                    select: { id: true, name: true, stockGdg: true, minStock: true, unit: true, unitType: true },
                });
                const lowStockIngredients = ingredients.filter((i) => i.stockGdg <= i.minStock);
                if (lowStockIngredients.length > 0) {
                    const uniqueUnits = [...new Set(lowStockIngredients.map((i) => i.unitType))];
                    for (const ingUnitType of uniqueUnits) {
                        const adminIds = await getNotificationRecipients(ingUnitType);
                        if (adminIds.length > 0) {
                            const unitIngs = lowStockIngredients.filter((i) => i.unitType === ingUnitType);
                            for (const ing of unitIngs) {
                                await createNotification({
                                    userId: adminIds,
                                    type: "low_stock",
                                    title: "Bahan Baku Menipis",
                                    message: `Bahan Baku ${ing.name}: sisa ${ing.stockGdg} ${ing.unit} (min: ${ing.minStock})`,
                                    data: { productId: ing.id, unitType: ing.unitType, isIngredient: true },
                                });
                            }
                        }
                    }
                }
            }
        } catch (e) { /* notification failure must not break response */ }

        return NextResponse.json({
            data: {
                saleNo: result.saleNo,
                totalAmount: result.totalAmount,
                cashReceived: Number(result.sale.cashReceived),
                changeAmount: Number(result.sale.changeAmount),
                paymentMethod: method,
                items: result.sale.items?.length || 0,
            },
        }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/toko/sales error:", error);
        if (error?.code === "P2002") {
            return NextResponse.json(
                { message: "Nomor transaksi bentrok, silakan coba lagi" },
                { status: 409 }
            );
        }
        const errMsg = error?.message || String(error);
        // Distinguish user-facing validation errors from system errors
        const status = errMsg.includes("tidak ditemukan") || errMsg.includes("tidak mencukupi") || errMsg.includes("kurang") || errMsg.includes("ditolak") || errMsg.includes("tidak aktif") || errMsg.includes("lebih dari 0")
            ? 400 : 500;
        return NextResponse.json({ message: errMsg }, { status });
    }
}
