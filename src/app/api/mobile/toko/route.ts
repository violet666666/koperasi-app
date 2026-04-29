import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// GET /api/mobile/toko?search=xxx&unitType=xxx
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const unitType = url.searchParams.get("unitType") || "toko";

    try {
        const where: any = { isActive: true, deletedAt: null };
        if (unitType) where.unitType = unitType;

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }

        const products = await prisma.storeProduct.findMany({
            where,
            select: { id: true, sku: true, name: true, sellPrice: true, stock: true, stockToko: true, stockGdg: true, unit: true, category: true, unitType: true, discountType: true, discountValue: true, isService: true },
            orderBy: { name: "asc" },
            take: 50,
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id, sku: p.sku, name: p.name,
                price: Number(p.sellPrice), stock: p.stockToko + p.stockGdg,
                unit: p.unit, category: p.category, unitType: p.unitType,
                discountType: p.discountType, discountValue: Number(p.discountValue),
                isService: p.isService,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/toko error:", error);
        return NextResponse.json({ message: "Gagal memuat produk" }, { status: 500 });
    }
}

// POST /api/mobile/toko — Process checkout via StoreSale
// Parity with web POS: uses $transaction, proper stock fields, shift, journal, movements
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "kasir" && user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { items, paymentMethod, memberId, customerName, unitType = "toko" } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang belanja kosong" }, { status: 400 });
        }
        if (!paymentMethod || !["cash", "credit", "salary_cut", "qris"].includes(paymentMethod)) {
            return NextResponse.json({ message: "Metode pembayaran harus cash, qris, atau salary_cut" }, { status: 400 });
        }

        // Validate quantities (parseFloat untuk mendukung nilai desimal seperti Laundry kg)
        for (const item of items) {
            const qty = parseFloat(item.quantity);
            if (!qty || qty <= 0 || isNaN(qty)) {
                return NextResponse.json({ message: "Jumlah item harus lebih dari 0" }, { status: 400 });
            }
        }

        const method = paymentMethod === "credit" ? "salary_cut" : paymentMethod;

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        const userId = Number(user.id);

        // Pre-transaction: lookup accounts (read-only)
        const [currentPeriod, kasAccount, piutangTokoAccount, tokoIncomeAccount, headOffice] = await Promise.all([
            prisma.fiscalPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } }),
            prisma.account.findFirst({ where: { code: "1101" } }),
            prisma.account.findFirst({ where: { code: "1301" } }),
            prisma.account.findFirst({ where: { code: "4201" } }),
            prisma.branch.findFirst({ where: { isHeadOffice: true } }),
        ]);

        // Run everything inside interactive transaction (same pattern as web POS)
        const result = await prisma.$transaction(async (tx) => {
            // Auto-detect shift
            let shiftId: number | null = null;
            const openShift = await tx.cashierShift.findFirst({
                where: { userId, status: "open", unitType },
            });
            shiftId = openShift?.id || null;

            // Validate stock and calculate total
            let totalAmount = 0;
            const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; discount: number }[] = [];

            for (const item of items) {
                const product = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                if (!product || !product.isActive || product.deletedAt) {
                    throw new Error(`Produk ID ${item.productId} tidak ditemukan atau tidak aktif`);
                }
                if (!product.isService) {
                    const effectiveStock = product.stockToko + product.stockGdg;
                    if (effectiveStock < item.quantity) {
                        throw new Error(`Stok ${product.name} tidak cukup (sisa: ${effectiveStock})`);
                    }
                }

                // Apply discount (same logic as web POS)
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

                validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, discount });
            }

            // Validate credit limit for salary_cut
            if (method === "salary_cut" && memberId) {
                const member = await tx.member.findUnique({ where: { id: memberId } });
                if (!member) throw new Error("Anggota tidak ditemukan");

                const tagihanUnitTx = await tx.unitTransaction.aggregate({
                    where: {
                        memberId: member.id, paymentMethod: "salary_cut",
                        isPaid: false, status: { in: ["completed", "pending_void"] },
                    },
                    _sum: { amount: true },
                });
                const totalTagihan = Number(tagihanUnitTx._sum.amount || 0);
                let plafonPiutang = Number(member.plafonPiutang || 0);

                if (plafonPiutang === 0 && Number(member.salary || 0) > 0) {
                    const activeLoans = await tx.loan.findMany({
                        where: { memberId: member.id, status: { in: ["active", "overdue"] } },
                        select: { monthlyInstallment: true },
                    });
                    const totalAngsuran = activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment || 0), 0);
                    const sisaBersih = Number(member.salary || 0) + Number(member.tunlesKinerja || 0) - totalAngsuran;
                    plafonPiutang = Math.max(0, Math.floor(sisaBersih * 0.5));
                }

                if (totalAmount > plafonPiutang - totalTagihan) {
                    throw new Error(`Limit piutang tidak cukup. Sisa: Rp ${(plafonPiutang - totalTagihan).toLocaleString("id-ID")}`);
                }
            }

            // Generate sequential sale number: POS-M-DDMMYYYY-0001 (with retry for concurrency)
            const now = new Date();
            const datePart = `${String(now.getDate()).padStart(2, "0")}${String(now.getMonth() + 1).padStart(2, "0")}${now.getFullYear()}`;
            const saleNoPrefix = `POS-M-${datePart}-`;
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

            let payment = method === "cash" || method === "qris" ? totalAmount : 0;
            let changeAmount = 0;

            // Create journal (same as web POS)
            let journalId: number | null = null;
            try {
                if (tokoIncomeAccount && headOffice && currentPeriod) {
                    const debitAccountId = method === "salary_cut"
                        ? (piutangTokoAccount?.id || kasAccount?.id)
                        : kasAccount?.id;
                    if (debitAccountId) {
                        const journal = await tx.journal.create({
                            data: {
                                journalNo: `JRN-M-${Date.now().toString(36).toUpperCase()}`,
                                branchId: headOffice.id, transactionDate: now,
                                description: `Penjualan Mobile ${unitType} ${method === "salary_cut" ? "(Potong Gaji)" : method === "qris" ? "(QRIS)" : "(Tunai)"} - ${saleNo}`,
                                sourceType: "store_sale", periodId: currentPeriod.id,
                                isPosted: true, createdById: userId,
                            },
                        });
                        await tx.journalLine.createMany({
                            data: [
                                { journalId: journal.id, accountId: debitAccountId, debit: totalAmount, credit: 0, description: method === "salary_cut" ? `Piutang ${unitType} (mobile)` : `Kas masuk penjualan mobile ${unitType}` },
                                { journalId: journal.id, accountId: tokoIncomeAccount.id, debit: 0, credit: totalAmount, description: "Pendapatan toko (mobile)" },
                            ],
                        });
                        journalId = journal.id;
                    }
                }
            } catch (journalErr) {
                console.error("[Mobile POS] Journal creation failed (non-fatal):", journalErr);
            }

            // Create sale record
            const sale = await tx.storeSale.create({
                data: {
                    saleNo,
                    memberId: method === "salary_cut" ? Number(memberId) : null,
                    unitType, customerName: customerName || null,
                    totalAmount, paymentMethod: method,
                    cashReceived: payment, changeAmount,
                    metadata: null, journalId,
                    periodId: currentPeriod?.id || null,
                    shiftId, createdById: userId,
                    items: {
                        create: validatedItems.map((vi) => ({
                            productId: vi.productId, quantity: vi.quantity,
                            unitPrice: vi.unitPrice, discount: vi.discount, subtotal: vi.subtotal,
                        })),
                    },
                },
            });

            // Deduct stock — proper 3-field update (stockToko/stockGdg/stock), same as web POS
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
                        data: { stockToko: newStockToko, stockGdg: newStockGdg, stock: newStockToko + newStockGdg },
                    });

                    // Stock movement log
                    await tx.storeStockMovement.create({
                        data: {
                            productId: vi.productId, type: "out", quantity: vi.quantity,
                            reference: `Penjualan Mobile ${saleNo}`,
                            notes: `Terjual Mobile (${method})`, operatorId: userId,
                        },
                    });
                }
            }

            // Cash/bank sync (inside transaction — atomic)
            if (method === "cash" || method === "qris") {
                const accountType = method === "cash" ? "cash" : "bank";
                let targetAccount = await tx.cashBankAccount.findFirst({
                    where: { type: accountType, unitType, isActive: true },
                    orderBy: { id: "asc" },
                });
                if (!targetAccount) {
                    targetAccount = await tx.cashBankAccount.findFirst({
                        where: { type: accountType, unitType: null, purpose: "operasional", isActive: true },
                        orderBy: { id: "asc" },
                    });
                }
                if (targetAccount) {
                    const currentBal = Number(targetAccount.currentBalance);
                    const newBal = currentBal + totalAmount;
                    await tx.cashBankTransaction.create({
                        data: {
                            transactionNo: `MB-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                            accountId: targetAccount.id, branchId: targetAccount.branchId,
                            type: "in", category: "pendapatan_toko", amount: totalAmount,
                            balanceBefore: currentBal, balanceAfter: newBal, unitType,
                            description: `Penjualan Mobile ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${saleNo}`,
                            transactionDate: now, createdById: userId,
                        },
                    });
                    await tx.cashBankAccount.update({
                        where: { id: targetAccount.id }, data: { currentBalance: newBal },
                    });
                }
            }

            // Piutang for salary_cut
            if (method === "salary_cut" && memberId) {
                await tx.unitTransaction.create({
                    data: {
                        transactionNo: `MB-UTG-${Date.now().toString(36).toUpperCase()}`,
                        memberId: Number(memberId), unitType,
                        description: `Piutang ${unitType} (Mobile Potong Gaji) - ${saleNo}`,
                        amount: totalAmount, transactionDate: now, isPaid: false,
                        notes: `Auto-generated dari penjualan kasir mobile. No. Transaksi: ${saleNo}`,
                        createdById: userId,
                    },
                });
            }

            return { saleId: sale.id, saleNo, totalAmount };
        }, { maxWait: 10000, timeout: 30000 });

        await logAudit({
            userId, userName: user.name,
            action: "CREATE", module: "Toko",
            description: `Checkout Mobile ${method} Rp ${result.totalAmount.toLocaleString("id-ID")} (${items.length} item) Unit ${unitType}`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: "Checkout berhasil!",
            data: { total: result.totalAmount, paymentMethod: method, itemCount: items.length, saleNo: result.saleNo },
        });
    } catch (error: any) {
        console.error("POST /api/mobile/toko error:", error);
        const errMsg = error?.message || "Gagal memproses checkout";
        const status = errMsg.includes("tidak ditemukan") || errMsg.includes("tidak cukup") || errMsg.includes("limit") || errMsg.includes("lebih dari 0") || errMsg.includes("tidak aktif")
            ? 400 : 500;
        return NextResponse.json({ message: errMsg }, { status });
    }
}
