import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { validateSplitBill, calculateSplitTotal, generateSplitGroupId } from "@/lib/split-bill";
import { isFbUnit } from "@/lib/constants/units";
import { findUnitAccount } from "@/lib/cash-bank";
import { getPlafonPiutang } from "@/lib/plafon";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = ["admin", "operator", "kasir"];

// POST /api/toko/split-bill — Process split payment with full accounting
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { items, payments, unitType, customerName, tableNo, shiftId: reqShiftId, memberId, splitGroupId: existingGroupId, metadata: reqMetadata } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "items required" }, { status: 400 });
        }

        // Server-side quantity validation
        for (const item of items) {
            const qty = Number(item.quantity);
            if (!qty || qty <= 0 || isNaN(qty)) {
                return NextResponse.json({ message: "Jumlah item harus lebih dari 0" }, { status: 400 });
            }
        }

        const validation = validateSplitBill({ items, payments });
        if (!validation.valid) {
            return NextResponse.json({ message: validation.errors.join(", ") }, { status: 400 });
        }

        const unitTypeVal = unitType || "resto";
        const userId = Number(session.user.id);
        const salePrefixMap: Record<string, string> = { toko: "TK", playstation: "PS", cafe_lsp: "CF", resto_cafe: "RC", resto: "RS", coffe_latar: "CL" };
        const unitPrefix = salePrefixMap[unitTypeVal] || "TK";
        const groupId = existingGroupId || generateSplitGroupId();

        // Pre-validate salary_cut members before transaction
        const salaryCutPayments = (payments || []).filter((p: any) => p.method === "salary_cut");
        const preValidatedMembers = new Map<number, any>();
        for (const p of salaryCutPayments) {
            if (!p.memberId) {
                return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
            }
            const member = await prisma.member.findUnique({ where: { id: p.memberId } });
            if (!member) {
                return NextResponse.json({ message: `Anggota ID ${p.memberId} tidak ditemukan` }, { status: 404 });
            }
            preValidatedMembers.set(p.memberId, member);
        }

        // Lookup accounts (read-only, static)
        const [currentPeriod, kasAccount, piutangTokoAccount, tokoIncomeAccount, headOffice] = await Promise.all([
            prisma.fiscalPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } }),
            prisma.account.findFirst({ where: { code: "1101" } }),
            prisma.account.findFirst({ where: { code: "1301" } }),
            prisma.account.findFirst({ where: { code: "4201" } }),
            prisma.branch.findFirst({ where: { isHeadOffice: true } }),
        ]);

        const result = await prisma.$transaction(async (tx) => {
            // Auto-detect shift
            let shiftId: number | null = reqShiftId ? Number(reqShiftId) : null;
            if (!shiftId) {
                const openShift = await tx.cashierShift.findFirst({
                    where: { userId, status: "open", unitType: unitTypeVal },
                });
                shiftId = openShift?.id || null;
            }

            // Fetch all products for server-side price validation
            const productIds = items.map((item: any) => item.productId);
            const productRows = await tx.storeProduct.findMany({ where: { id: { in: productIds } } });
            const productMap = new Map(productRows.map(p => [p.id, p]));

            // Validate each product and compute server-side prices
            let orderTotal = 0;
            const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; discount: number; costPrice: number }[] = [];

            for (const item of items) {
                const product = productMap.get(item.productId);
                if (!product) throw new Error(`Produk ID ${item.productId} tidak ditemukan`);
                if (!product.isActive || product.deletedAt) throw new Error(`Produk "${product.name}" tidak aktif`);
                if (product.unitType !== unitTypeVal) throw new Error(`Produk "${product.name}" bukan milik unit ${unitTypeVal}`);

                const isRacikan = product.trackStock === false;
                if (!product.isService) {
                    if (isRacikan) {
                        const recipes = await tx.productRecipe.findMany({
                            where: { productId: product.id, ingredientProductId: { not: null } },
                        });
                        for (const recipe of recipes) {
                            const ingredient = await tx.storeProduct.findUnique({ where: { id: recipe.ingredientProductId! } });
                            if (!ingredient) continue;
                            const needed = Math.ceil(Number(recipe.quantity) * item.quantity);
                            const available = ingredient.stock + ingredient.stockGdg;
                            if (available < needed) {
                                throw new Error(`Bahan baku ${ingredient.name} tidak mencukupi (sisa: ${available}, dibutuhkan: ${needed})`);
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

                let taxAmount = 0;
                if (isFbUnit(unitTypeVal) && product.taxType === "exclusive" && Number(product.taxRate) > 0) {
                    taxAmount = Math.round(unitPrice * Number(product.taxRate) / 100);
                }
                const totalUnitPrice = unitPrice + taxAmount;
                const subtotal = totalUnitPrice * item.quantity;
                orderTotal += subtotal;

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice: totalUnitPrice, subtotal, discount, costPrice: Number(product.costPrice) || 0, taxAmount });
            }

            // Verify payment total matches server-computed total
            const paymentsTotal = payments.reduce((sum: number, p: any) => sum + p.amount, 0);
            if (paymentsTotal !== orderTotal) {
                throw new Error(`Total pembayaran (${paymentsTotal}) tidak sesuai total pesanan (${orderTotal})`);
            }

            // Credit limit check for all salary_cut payments
            for (const p of salaryCutPayments) {
                const member = preValidatedMembers.get(p.memberId);
                if (!member) continue;

                const tagihanUnitTx = await tx.unitTransaction.aggregate({
                    where: { memberId: p.memberId, paymentMethod: "salary_cut", isPaid: false, status: { in: ["completed", "pending_void"] } },
                    _sum: { amount: true },
                });
                const totalTagihan = Number(tagihanUnitTx._sum.amount || 0);
                const plafonPiutang = getPlafonPiutang(member);
                const sisaLimit = plafonPiutang - totalTagihan;
                if (p.amount > sisaLimit) {
                    throw new Error(`Limit piutang tidak cukup untuk potong gaji. Sisa: Rp ${sisaLimit.toLocaleString("id-ID")}`);
                }
            }

            // Allocate items proportionally across payments
            const allocatedPayments: { payment: any; allocatedItems: typeof validatedItems; saleNo: string }[] = [];
            const now = new Date();
            const datePart = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
            const saleNoPrefix = `${unitPrefix}-${datePart}-`;
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayCount = await tx.storeSale.count({ where: { createdAt: { gte: startOfDay }, unitType: unitTypeVal } });

            let saleNoIdx = todayCount + 1;
            for (const payment of payments) {
                // Generate unique sale number
                let saleNo = "";
                for (let attempt = saleNoIdx; attempt < saleNoIdx + 100; attempt++) {
                    const candidate = saleNoPrefix + String(attempt).padStart(4, "0");
                    const exists = await tx.storeSale.findUnique({ where: { saleNo: candidate } });
                    if (!exists) { saleNo = candidate; saleNoIdx = attempt + 1; break; }
                }
                if (!saleNo) saleNo = saleNoPrefix + String(saleNoIdx++).padStart(4, "0");

                const ratio = payment.amount / orderTotal;
                const allocatedItems = validatedItems.map(vi => {
                    const allocQty = Math.max(1, Math.round(vi.quantity * ratio));
                    const allocSubtotal = Math.round(vi.unitPrice * allocQty);
                    return { ...vi, quantity: allocQty, subtotal: allocSubtotal };
                });

                // Adjust last item to match exact payment amount
                const allocTotal = allocatedItems.reduce((s, i) => s + i.subtotal, 0);
                if (allocatedItems.length > 0 && allocTotal !== payment.amount) {
                    allocatedItems[allocatedItems.length - 1].subtotal += payment.amount - allocTotal;
                }

                allocatedPayments.push({ payment, allocatedItems, saleNo });
            }

            // Process each payment: create sale, journal, piutang, cash/bank
            const sales = [];
            for (const { payment, allocatedItems, saleNo } of allocatedPayments) {
                const paymentAmount = payment.amount;
                const method = payment.method;

                // Create journal entry
                let journalId: number | null = null;
                try {
                    if (tokoIncomeAccount && headOffice && currentPeriod) {
                        const debitAccountId = method === "salary_cut"
                            ? (piutangTokoAccount?.id || kasAccount?.id)
                            : kasAccount?.id;

                        if (debitAccountId) {
                            const journal = await tx.journal.create({
                                data: {
                                    journalNo: `JRN-${Date.now().toString(36).toUpperCase()}-${sales.length}`,
                                    branchId: headOffice.id,
                                    transactionDate: now,
                                    description: `Split Bill ${unitTypeVal} (${method}) - ${saleNo} [${groupId}]`,
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
                                        debit: paymentAmount,
                                        credit: 0,
                                        description: method === "salary_cut"
                                            ? `Piutang ${unitTypeVal} (potong gaji) - Split ${groupId}`
                                            : `Kas masuk split bill ${unitTypeVal}`,
                                    },
                                    {
                                        journalId: journal.id,
                                        accountId: tokoIncomeAccount.id,
                                        debit: 0,
                                        credit: paymentAmount,
                                        description: "Pendapatan toko (split bill)",
                                    },
                                ],
                            });

                            journalId = journal.id;
                        }
                    }
                } catch (journalErr) {
                    console.error("[SplitBill] Journal creation failed (non-fatal):", journalErr);
                }

                const saleMetadata: any = {
                    splitGroupId: groupId,
                    splitPaymentMethod: method,
                    orderType: tableNo ? "dine_in" : "takeaway",
                    ...(reqMetadata || {}),
                };
                if (tableNo) saleMetadata.tableNo = tableNo;
                if (payment.memberId) saleMetadata.memberId = payment.memberId;

                const sale = await tx.storeSale.create({
                    data: {
                        saleNo,
                        memberId: payment.memberId ? Number(payment.memberId) : (memberId ? Number(memberId) : null),
                        unitType: unitTypeVal,
                        customerName: customerName || "Tamu",
                        totalAmount: paymentAmount,
                        paymentMethod: method,
                        cashReceived: (method === "cash" || method === "qris") ? paymentAmount : 0,
                        changeAmount: 0,
                        metadata: saleMetadata,
                        journalId,
                        periodId: currentPeriod?.id || null,
                        shiftId,
                        createdById: userId,
                        items: {
                            create: allocatedItems.map(vi => ({
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

                // Update cash/bank account
                if (method === "cash" || method === "qris") {
                    const accountType = method === "cash" ? "cash" : "bank";
                    const targetAccount = await findUnitAccount(tx, unitTypeVal, accountType);

                    if (targetAccount) {
                        const updatedAccount = await tx.cashBankAccount.update({
                            where: { id: targetAccount.id },
                            data: { currentBalance: { increment: paymentAmount } },
                        });
                        const balanceBefore = Number(updatedAccount.currentBalance) - paymentAmount;

                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `${unitPrefix}-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}-${sales.length}`,
                                accountId: targetAccount.id,
                                branchId: targetAccount.branchId,
                                type: "in",
                                category: "pendapatan_toko",
                                amount: paymentAmount,
                                balanceBefore,
                                balanceAfter: Number(updatedAccount.currentBalance),
                                unitType: unitTypeVal,
                                description: `Split Bill ${unitTypeVal} (${method}) - ${saleNo}`,
                                transactionDate: now,
                                createdById: userId,
                            },
                        });
                    }
                }

                // Create piutang for salary_cut
                if (method === "salary_cut" && payment.memberId) {
                    await tx.unitTransaction.create({
                        data: {
                            transactionNo: `${unitPrefix}-UTG-${Date.now().toString(36).toUpperCase()}-${sales.length}`,
                            memberId: payment.memberId,
                            unitType: unitTypeVal,
                            description: `Piutang ${unitTypeVal} (Potongan Gaji) - Split ${groupId} - ${saleNo}`,
                            amount: paymentAmount,
                            transactionDate: now,
                            paymentMethod: "salary_cut",
                            isPaid: false,
                            notes: `Auto-generated dari split bill. Group: ${groupId}`,
                            createdById: userId,
                        },
                    });
                }

                sales.push(sale);
            }

            // Stock deduction (FIFO batch) — use original full quantities
            const allBatches = await tx.stockBatch.findMany({
                where: { productId: { in: productIds }, isActive: true, quantity: { gt: 0 }, unitType: unitTypeVal },
                orderBy: { receivedAt: "asc" },
            });
            const batchesByProduct = new Map<number, typeof allBatches>();
            for (const b of allBatches) {
                if (!batchesByProduct.has(b.productId)) batchesByProduct.set(b.productId, []);
                batchesByProduct.get(b.productId)!.push(b);
            }

            const runningStock = new Map(productRows.map(p => [p.id, { toko: Number(p.stockToko), gdg: Number(p.stockGdg) }]));
            const stockMovements: any[] = [];
            const batchUpdates: { id: number; newQty: number }[] = [];
            const ingredientDeductions = new Map<number, number>();
            const ingredientMovements: any[] = [];
            const ingredientBatchUpdates: { id: number; newQty: number }[] = [];

            for (const vi of validatedItems) {
                const prod = productMap.get(vi.productId);
                if (!prod || prod.isService) continue;

                const isRacikan = prod.trackStock === false;

                if (isRacikan) {
                    const recipes = await tx.productRecipe.findMany({
                        where: { productId: prod.id, ingredientProductId: { not: null } },
                    });

                    const ingredientIds = recipes.map(r => r.ingredientProductId!).filter(Boolean);
                    if (ingredientIds.length > 0) {
                        const ingBatches = await tx.stockBatch.findMany({
                            where: { productId: { in: ingredientIds }, isActive: true, quantity: { gt: 0 }, unitType: unitTypeVal },
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
                            ingredientDeductions.set(recipe.ingredientProductId, (ingredientDeductions.get(recipe.ingredientProductId) || 0) + needed);

                            let remaining = needed;
                            const ingBatchesList = ingBatchesByProduct.get(recipe.ingredientProductId) || [];
                            for (const ib of ingBatchesList) {
                                if (remaining <= 0) break;
                                const deduct = Math.min(ib.quantity, remaining);
                                ingredientBatchUpdates.push({ id: ib.id, newQty: ib.quantity - deduct });
                                ib.quantity = ib.quantity - deduct;
                                remaining -= deduct;
                            }
                        }
                    }
                } else {
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
                        reference: `Split Bill ${sales[0]?.saleNo || groupId}`,
                        notes: `Terjual (split bill)`,
                        operatorId: userId,
                        costAtTime: vi.costPrice,
                        reason: "sale",
                    });

                    let remainingToDeduct = vi.quantity;
                    const batches = batchesByProduct.get(vi.productId) || [];
                    for (const batch of batches) {
                        if (remainingToDeduct <= 0) break;
                        const deduct = Math.min(batch.quantity, remainingToDeduct);
                        batchUpdates.push({ id: batch.id, newQty: batch.quantity - deduct });
                        batch.quantity = batch.quantity - deduct;
                        remainingToDeduct -= deduct;
                    }
                }
            }

            // Process ingredient deductions for racikan
            if (ingredientDeductions.size > 0) {
                const ingIds = [...ingredientDeductions.keys()];
                const ingredientProducts = await tx.storeProduct.findMany({ where: { id: { in: ingIds } } });
                const ingStockMap = new Map(ingredientProducts.map(ip => [ip.id, { gdg: Number(ip.stockGdg), stock: Number(ip.stock) }]));

                for (const [ingId, deductQty] of ingredientDeductions) {
                    const ingStock = ingStockMap.get(ingId);
                    if (!ingStock) continue;
                    ingStockMap.set(ingId, { gdg: Math.max(0, ingStock.gdg - deductQty), stock: Math.max(0, ingStock.stock - deductQty) });

                    ingredientMovements.push({
                        productId: ingId, type: "out", quantity: deductQty,
                        reference: `Produksi Split ${groupId}`,
                        notes: `Digunakan untuk racikan (split bill)`,
                        operatorId: userId, reason: "production",
                    });
                }

                const ingStockCases = Array.from(ingStockMap.entries()).map(([id, s]) => `WHEN ${id} THEN ${s.stock}`).join(" ");
                const ingGdgCases = Array.from(ingStockMap.entries()).map(([id, s]) => `WHEN ${id} THEN ${s.gdg}`).join(" ");
                const ingTokoCases = Array.from(ingStockMap.entries()).map(([id]) => `WHEN ${id} THEN 0`).join(" ");
                const ingIdsStr = ingIds.join(",");

                await tx.$executeRawUnsafe(`
                    UPDATE store_products
                    SET stock = CASE id ${ingStockCases} END,
                        stock_toko = CASE id ${ingTokoCases} END,
                        stock_gdg = CASE id ${ingGdgCases} END
                    WHERE id IN (${ingIdsStr})
                `);

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

                if (ingredientMovements.length > 0) {
                    await tx.storeStockMovement.createMany({ data: ingredientMovements });
                }
            }

            // Update product stocks (retail)
            if (stockMovements.length > 0) {
                const productStockCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.toko + s.gdg}`).join(" ");
                const tokoCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.toko}`).join(" ");
                const gdgCases = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id, s]) => `WHEN ${id} THEN ${s.gdg}`).join(" ");
                const productIdsToUpdate = Array.from(runningStock.entries())
                    .filter(([id]) => stockMovements.some(m => m.productId === id))
                    .map(([id]) => id).join(",");

                await tx.$executeRawUnsafe(`
                    UPDATE store_products
                    SET stock = CASE id ${productStockCases} END,
                        stock_toko = CASE id ${tokoCases} END,
                        stock_gdg = CASE id ${gdgCases} END
                    WHERE id IN (${productIdsToUpdate})
                `);

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

                await tx.storeStockMovement.createMany({ data: stockMovements });
            }

            return { sales, groupId, orderTotal };
        }, {
            maxWait: 15000,
            timeout: 60000,
        });

        // Audit log (outside transaction)
        try {
            const reqInfo = extractRequestInfo(req);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Toko", unitType: unitTypeVal,
                description: `Split Bill ${result.groupId}: ${result.sales.length} pembayaran - Rp ${result.orderTotal.toLocaleString()}`,
                targetId: result.groupId, targetType: "SplitBill",
                newData: { groupId: result.groupId, totalAmount: result.orderTotal, paymentCount: result.sales.length, unitType: unitTypeVal },
            });
        } catch (e) { /* non-critical */ }

        return NextResponse.json({
            message: "Split bill processed",
            splitGroupId: result.groupId,
            sales: result.sales,
            totalSales: result.sales.length,
            orderTotal: result.orderTotal,
        }, { status: 201 });
    } catch (error) {
        console.error("[SplitBill] POST error:", error);
        const message = error instanceof Error ? error.message : "Internal server error";
        return NextResponse.json({ message }, { status: message === "Internal server error" ? 500 : 400 });
    }
}
