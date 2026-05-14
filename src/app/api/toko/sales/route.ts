import { NextResponse } from "next/server";
import prisma, { prismaRead } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { createNotification, getNotificationRecipients } from "@/lib/notifications";

const ALLOWED_SALES_ROLES = ["admin", "operator", "super_admin", "kasir"];

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
        const unitType = searchParams.get("unitType") || null;
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));
        const search = searchParams.get("search")?.trim() || null;
        const paymentMethods = searchParams.get("paymentMethods")?.split(",").filter(Boolean) || null;
        const showVoided = searchParams.get("showVoided") !== "false"; // default true
        const shiftId = searchParams.get("shiftId") || null;
        const fromDate = searchParams.get("from") ? new Date(searchParams.get("from")!) : null;
        const toDate = searchParams.get("to") ? new Date(searchParams.get("to")!) : null;

        // Build where clause
        const where: Record<string, unknown> = {
            ...(unitType && { unitType }),
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
            orderBy: { createdAt: "desc" } as const,
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

                // Check stock for physical products
                if (!product.isService) {
                    const effectiveStock = product.stockToko + product.stockGdg;
                    if (effectiveStock < item.quantity) {
                        throw new Error(`Stok ${product.name} tidak mencukupi (sisa: ${effectiveStock})`);
                    }
                }

                const rawPrice = Number(product.sellPrice);
                let discount = 0;
                if (product.discountType === "percent" && Number(product.discountValue) > 0) {
                    discount = Math.round(rawPrice * Number(product.discountValue) / 100);
                } else if (product.discountType === "fixed" && Number(product.discountValue) > 0) {
                    discount = Math.min(Number(product.discountValue), rawPrice);
                }
                const unitPrice = rawPrice - discount;
                const subtotal = unitPrice * item.quantity;
                totalAmount += subtotal;

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, discount, costPrice: Number(product.costPrice) || 0 });
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
                let plafonPiutang = Number(preValidatedMember?.plafonPiutang || 0);

                if (plafonPiutang === 0 && Number(preValidatedMember?.salary || 0) > 0) {
                    // salary = SISA GAJI (JUMLAH GAJI DITERIMA) — net after all deductions
                    plafonPiutang = Math.max(0, Math.floor(Number(preValidatedMember.salary) * 0.5));
                }

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

            for (const vi of validatedItems) {
                const prod = productMap.get(vi.productId);
                if (!prod || prod.isService) continue;

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
                let targetAccount = await tx.cashBankAccount.findFirst({
                    where: { type: accountType, isActive: true, unitTypes: { array_contains: unitType } as any },
                    orderBy: { id: "asc" },
                });
                if (!targetAccount) {
                    targetAccount = await tx.cashBankAccount.findFirst({
                        where: { type: accountType, unitType: unitType, isActive: true },
                        orderBy: { id: "asc" },
                    });
                }
                if (!targetAccount) {
                    targetAccount = await tx.cashBankAccount.findFirst({
                        where: { type: accountType, unitType: null, purpose: "operasional", isActive: true },
                        orderBy: { id: "asc" },
                    });
                }

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

            return { sale, totalAmount: Number(sale.totalAmount), saleNo: sale.saleNo };
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
        const errMsg = error?.message || String(error);
        // Distinguish user-facing validation errors from system errors
        const status = errMsg.includes("tidak ditemukan") || errMsg.includes("tidak mencukupi") || errMsg.includes("kurang") || errMsg.includes("ditolak") || errMsg.includes("tidak aktif") || errMsg.includes("lebih dari 0")
            ? 400 : 500;
        return NextResponse.json({ message: errMsg }, { status });
    }
}
