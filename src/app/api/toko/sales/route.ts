import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

        // Build where clause
        const where: Record<string, unknown> = {
            ...(unitType && { unitType }),
        };

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

        const [sales, total] = await Promise.all([
            prisma.storeSale.findMany({
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
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.storeSale.count({ where: where as any }),
        ]);

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
        const { items, customerName, paymentMethod, cashReceived, memberId, unitType: reqUnitType, metadata, shiftId: reqShiftId, cashierIdentityId } = body;
        const unitType = reqUnitType || "toko";

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang kosong" }, { status: 400 });
        }

        // Server-side validation: reject negative/zero quantities
        for (const item of items) {
            const qty = parseInt(item.quantity, 10);
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
                    where: { userId, status: "open", unitType },
                });
                shiftId = openShift?.id || null;
            } else {
                // Validate provided shift belongs to same unit
                const shift = await tx.cashierShift.findUnique({ where: { id: shiftId } });
                if (!shift || shift.status !== "open") {
                    throw new Error("Shift tidak valid atau sudah ditutup");
                }
                if (shift.unitType !== unitType) {
                    throw new Error("Shift tidak sesuai dengan unit");
                }
            }

            // Validate stock with row-level awareness (inside transaction)
            let totalAmount = 0;
            const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; discount: number; costPrice: number }[] = [];

            for (const item of items) {
                const product = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                if (!product) {
                    throw new Error(`Produk ID ${item.productId} tidak ditemukan`);
                }
                if (!product.isActive || product.deletedAt) {
                    throw new Error(`Produk "${product.name}" tidak aktif atau sudah dihapus`);
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
                    const activeLoans = await tx.loan.findMany({
                        where: { memberId: memberId, status: { in: ["active", "overdue"] } },
                        select: { monthlyInstallment: true },
                    });
                    const totalAngsuran = activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment || 0), 0);
                    const salary = Number(preValidatedMember.salary || 0);
                    const tunkin = Number(preValidatedMember.tunlesKinerja || 0);
                    const sisaBersih = salary + tunkin - totalAngsuran;
                    plafonPiutang = Math.max(0, Math.floor(sisaBersih * 0.5));
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
            const saleNoPrefix = `TK-${datePart}-`;
            const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const todayCount = await tx.storeSale.count({
                where: { createdAt: { gte: startOfDay } },
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

            // Deduct stock (same transaction — no race condition)
            for (const vi of validatedItems) {
                const prod = await tx.storeProduct.findUnique({ where: { id: vi.productId } });
                if (prod && !prod.isService) {
                    let newStockToko = prod.stockToko;
                    let newStockGdg = prod.stockGdg;

                    if (prod.stockToko >= vi.quantity) {
                        newStockToko = prod.stockToko - vi.quantity;
                    } else {
                        const sisaFromToko = prod.stockToko;
                        const kurangDariGdg = vi.quantity - sisaFromToko;
                        newStockToko = 0;
                        newStockGdg = Math.max(0, prod.stockGdg - kurangDariGdg);
                    }

                    await tx.storeProduct.update({
                        where: { id: vi.productId },
                        data: {
                            stockToko: newStockToko,
                            stockGdg: newStockGdg,
                            stock: newStockToko + newStockGdg,
                        },
                    });

                    await tx.storeStockMovement.create({
                        data: {
                            productId: vi.productId,
                            type: "out",
                            quantity: vi.quantity,
                            reference: `Penjualan ${saleNo}`,
                            notes: `Terjual (${method})`,
                            operatorId: userId,
                            costAtTime: vi.costPrice,
                            reason: "sale",
                        },
                    });

                    // FIFO batch deduction — consume oldest active batches first
                    let remainingToDeduct = vi.quantity;
                    const batches = await tx.stockBatch.findMany({
                        where: { productId: vi.productId, isActive: true, quantity: { gt: 0 } },
                        orderBy: { receivedAt: "asc" },
                    });
                    for (const batch of batches) {
                        if (remainingToDeduct <= 0) break;
                        const deduct = Math.min(batch.quantity, remainingToDeduct);
                        const newQty = batch.quantity - deduct;
                        await tx.stockBatch.update({
                            where: { id: batch.id },
                            data: { quantity: newQty, isActive: newQty > 0 },
                        });
                        remainingToDeduct -= deduct;
                    }
                }
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
                            transactionNo: `TK-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
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
                        transactionNo: `TK-UTG-${Date.now().toString(36).toUpperCase()}`,
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
                action: "CREATE", module: "Toko",
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
                const adminIds = await getNotificationRecipients("toko");
                if (adminIds.length > 0) {
                    for (const prod of lowStockProducts) {
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
