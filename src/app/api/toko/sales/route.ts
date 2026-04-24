import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// GET /api/toko/sales - List sales with items
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "100");
        const unitType = searchParams.get("unitType") || null;

        const sales = await prisma.storeSale.findMany({
            where: {
                ...(unitType && { unitType }),
            },
            include: {
                items: {
                    include: { product: { select: { id: true, sku: true, name: true } } },
                },
                createdBy: { select: { id: true, name: true } },
                member: { select: { id: true, name: true, memberNo: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({
            data: sales.map((s: { id: number; saleNo: string; customerName: string | null; member: { id: number; name: string; memberNo: string } | null; totalAmount: unknown; paymentMethod: string; cashReceived: unknown; changeAmount: unknown; createdAt: Date; createdBy: { id: number; name: string }; items: Array<{ id: number; productId: number; product: { id: number; sku: string; name: string }; quantity: number; unitPrice: unknown; subtotal: unknown }> }) => ({
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
                items: s.items.map((i) => ({
                    id: i.id,
                    productId: i.productId,
                    product: i.product,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    subtotal: Number(i.subtotal),
                })),
            })),
        });
    } catch (error) {
        console.error("GET /api/toko/sales error:", error);
        return NextResponse.json({ message: "Failed to fetch sales" }, { status: 500 });
    }
}

// POST /api/toko/sales - Process a toko sale (checkout)
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { items, customerName, paymentMethod, cashReceived, createdById, memberId, unitType: reqUnitType, metadata, shiftId: reqShiftId } = body;
        const unitType = reqUnitType || "toko";

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang kosong" }, { status: 400 });
        }

        const userId = Number(session.user.id);

        // Auto-detect shift — jika tidak dikirim, cari shift open milik user ini
        let shiftId: number | null = reqShiftId ? Number(reqShiftId) : null;
        if (!shiftId) {
            const openShift = await prisma.cashierShift.findFirst({
                where: { userId, status: "open" },
            });
            shiftId = openShift?.id || null;
        }

        // Validate stock and calculate total
        let totalAmount = 0;
        const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; discount: number }[] = [];

        for (const item of items) {
            const product = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
            if (!product) {
                return NextResponse.json({ message: `Produk ID ${item.productId} tidak ditemukan` }, { status: 404 });
            }
            // IF product is physical (not service), validate stockToko (stok di toko, bukan gudang)
            const effectiveStock = product.stockToko > 0 ? product.stockToko : product.stock;
            if (!product.isService && effectiveStock < item.quantity) {
                return NextResponse.json({ message: `Stok ${product.name} tidak mencukupi (sisa di toko: ${effectiveStock})` }, { status: 400 });
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

            validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, discount });
        }

        // Validate payment for cash
        const method = paymentMethod || "cash";
        let payment = cashReceived || totalAmount;
        let changeAmount = 0;

        if (method === "cash") {
            if (payment < totalAmount) {
                return NextResponse.json({ message: "Pembayaran kurang" }, { status: 400 });
            }
            changeAmount = payment - totalAmount;
        } else if (method === "salary_cut") {
            // Credit: validate member exists
            if (!memberId) {
                return NextResponse.json({ message: "Member ID diperlukan untuk pembayaran potong gaji" }, { status: 400 });
            }
            const member = await prisma.member.findUnique({ where: { id: memberId } });
            if (!member) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }

            // ── SERVER-SIDE: Validasi Plafon Piutang ────────────────────
            const tagihanUnitTx = await prisma.unitTransaction.aggregate({
                where: {
                    memberId: member.id,
                    paymentMethod: "salary_cut",
                    isPaid: false,
                    status: { in: ["completed", "pending_void"] },
                },
                _sum: { amount: true },
            });
            const totalTagihan = Number(tagihanUnitTx._sum.amount || 0);
            
            let plafonPiutang = Number(member.plafonPiutang || 0);

            // FITUR OTOMATIS: Jika plafonPiutang masih 0, hitung limit kelayakan dari Sisa Gaji
            if (plafonPiutang === 0 && Number(member.salary || 0) > 0) {
                const activeLoans = await prisma.loan.findMany({
                    where: { memberId: member.id, status: { in: ["active", "overdue"] } },
                    select: { monthlyInstallment: true }
                });
                const totalAngsuran = activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment || 0), 0);
                
                const salary = Number(member.salary || 0);
                const tunkin = Number(member.tunlesKinerja || 0);
                const sisaBersih = salary + tunkin - totalAngsuran;
                
                const batasAman = 2000000;
                plafonPiutang = Math.max(0, sisaBersih - batasAman);
            }

            const sisaLimit = plafonPiutang - totalTagihan;

            if (totalAmount > sisaLimit) {
                return NextResponse.json({
                    message: `Transaksi ditolak: Sisa limit piutang Rp ${sisaLimit.toLocaleString("id-ID")} tidak cukup untuk belanja Rp ${totalAmount.toLocaleString("id-ID")}. Plafon: Rp ${plafonPiutang.toLocaleString("id-ID")}, Tagihan aktif: Rp ${totalTagihan.toLocaleString("id-ID")}.`,
                }, { status: 400 });
            }
            // ── END Validasi Plafon ──────────────────────────────────────

            payment = 0;
            changeAmount = 0;
        } else if (method === "qris") {
            payment = totalAmount;
            changeAmount = 0;
        }

        // Generate sale number — pakai timestamp + random agar unik meski 2 kasir bersamaan
        const now = new Date();
        const saleNo = `TK-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${Date.now().toString(36).toUpperCase()}`;

        // Find current open fiscal period
        const currentPeriod = await prisma.fiscalPeriod.findFirst({
            where: { status: "open" },
            orderBy: { startDate: "desc" },
        });

        // Lookup COA accounts for journal (best-effort)
        const kasAccount = await prisma.account.findFirst({ where: { code: "1101" } });
        const piutangTokoAccount = await prisma.account.findFirst({ where: { code: "1301" } }); // Piutang Toko
        const tokoIncomeAccount = await prisma.account.findFirst({ where: { code: "4201" } });
        const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });

        let journalId: number | null = null;

        // Journal creation is best-effort — if it fails (no period, missing COA, etc.) sale still goes through
        try {
            if (tokoIncomeAccount && headOffice && currentPeriod) {
                const debitAccountId = method === "salary_cut"
                    ? (piutangTokoAccount?.id || kasAccount?.id)
                    : kasAccount?.id;

                if (debitAccountId) {
                    // Use timestamp-based unique journal number to prevent race conditions
                    const journalNo = `JRN-${Date.now().toString(36).toUpperCase()}`;
                    const journal = await prisma.journal.create({
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

                    await prisma.journalLine.createMany({
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
            } else {
                console.warn(`[Toko Sales] Journal skipped: tokoIncomeAccount=${!!tokoIncomeAccount}, headOffice=${!!headOffice}, currentPeriod=${!!currentPeriod}`);
            }
        } catch (journalErr) {
            console.error("[Toko Sales] Journal creation failed (non-fatal):", journalErr);
            // journalId stays null — sale proceeds without journal
        }

        const sale = await prisma.storeSale.create({
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
                createdById: userId,
                items: {
                    create: validatedItems.map((vi) => ({
                        productId: vi.productId,
                        quantity: vi.quantity,
                        unitPrice: vi.unitPrice,
                        discount: vi.discount,
                        subtotal: vi.subtotal,
                    })),
                },
            },
            include: { items: { include: { product: true } } },
        });

        // Deduct stock (Only for physical products)
        for (const vi of validatedItems) {
            const prod = await prisma.storeProduct.findUnique({ where: { id: vi.productId } });
            if (prod && !prod.isService) {
                // Kurangi stockToko terlebih dahulu (stok di toko fisik).
                // Jika stockToko > 0, kurangi stockToko; jika stockToko 0, fallback ke stockGdg.
                // SELALU sinkronkan field `stock` (total) = stockGdg + stockToko.
                let newStockToko = prod.stockToko;
                let newStockGdg = prod.stockGdg;

                if (prod.stockToko >= vi.quantity) {
                    newStockToko = prod.stockToko - vi.quantity;
                } else {
                    // Ambil sisa dari gudang
                    const sisaFromToko = prod.stockToko;
                    const kurangDariGdg = vi.quantity - sisaFromToko;
                    newStockToko = 0;
                    newStockGdg = Math.max(0, prod.stockGdg - kurangDariGdg);
                }

                await prisma.storeProduct.update({
                    where: { id: vi.productId },
                    data: {
                        stockToko: newStockToko,
                        stockGdg: newStockGdg,
                        stock: newStockToko + newStockGdg, // SELALU SINKRON
                    },
                });

                // Insert log mutasi untuk inventori
                await prisma.storeStockMovement.create({
                    data: {
                        productId: vi.productId,
                        type: "out",
                        quantity: vi.quantity,
                        reference: `Penjualan ${saleNo}`,
                        notes: `Terjual (${method})`,
                        operatorId: userId
                    }
                });
            }
        }

        // ============================================================
        // FIX K-1: Sinkronisasi Kas Fisik & Bank
        // Saat penjualan tunai/QRIS, uang masuk dicatat ke CashBankTransaction
        // ============================================================
        if (method === "cash" || method === "qris") {
            try {
                // Temukan rekening kas/bank sesuai unit — multi-unit routing
                // Prioritas: unitTypes[] → unitType exact → null/default
                const accountType = method === "cash" ? "cash" : "bank";
                let targetAccount = await prisma.cashBankAccount.findFirst({
                    where: { 
                        type: accountType,
                        isActive: true,
                        unitTypes: { array_contains: unitType } as any,
                    },
                    orderBy: { id: "asc" },
                });

                if (!targetAccount) {
                    targetAccount = await prisma.cashBankAccount.findFirst({
                        where: { 
                            type: accountType,
                            unitType: unitType,
                            isActive: true 
                        },
                        orderBy: { id: "asc" },
                    });
                }

                if (!targetAccount) {
                    targetAccount = await prisma.cashBankAccount.findFirst({
                        where: { 
                            type: accountType,
                            unitType: null,
                            purpose: "operasional",
                            isActive: true 
                        },
                        orderBy: { id: "asc" },
                    });
                }

                if (targetAccount) {
                    const currentBal = Number(targetAccount.currentBalance);
                    const newBal = currentBal + totalAmount;

                    // Catat transaksi masuk di Buku Kas
                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: `TK-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                            accountId: targetAccount.id,
                            branchId: targetAccount.branchId,
                            type: "in",
                            category: "pendapatan_toko",
                            amount: totalAmount,
                            balanceBefore: currentBal,
                            balanceAfter: newBal,
                            unitType: unitType,
                            description: `Penjualan ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${saleNo}`,
                            transactionDate: now,
                            createdById: userId,
                        },
                    });

                    // Update saldo rekening
                    await prisma.cashBankAccount.update({
                        where: { id: targetAccount.id },
                        data: { currentBalance: newBal },
                    });
                } else {
                    console.error(`[Multi-Unit] Rekening ${method === "cash" ? "Kas" : "Bank"} untuk unit ${unitType} tidak ditemukan. Uang masuk tidak terjurnal ke rekening.`);
                }
            } catch (cashErr) {
                // Jangan batalkan transaksi — hanya log agar tidak merusak checkout
                console.error("[K-1] Gagal sinkronisasi kas tunai toko:", cashErr);
            }
        }

        // ============================================================
        // FIX K-3: Buat Tagihan Piutang (Kredit / Potong Gaji)
        // Saat potongan gaji, sistem membuat tagihan UnitTransaction
        // ============================================================
        if (method === "salary_cut" && memberId) {
            try {
                const memberForCredit = await prisma.member.findUnique({ where: { id: memberId } });
                if (memberForCredit) {
                    await prisma.unitTransaction.create({
                        data: {
                            transactionNo: `TK-UTG-${Date.now().toString(36).toUpperCase()}`,
                            memberId: memberId,
                            unitType: unitType,
                            description: `Piutang ${unitType} (Potongan Gaji) - ${saleNo}`,
                            amount: totalAmount,
                            transactionDate: now,
                            isPaid: false,
                            notes: `Auto-generated dari penjualan kasir. No. Transaksi: ${saleNo}`,
                            createdById: userId,
                        },
                    });
                }
            } catch (creditErr) {
                // Jangan batalkan transaksi — hanya log
                console.error("[K-3] Gagal membuat tagihan piutang kredit toko:", creditErr);
            }
        }

        // Audit log
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Toko",
                description: `Penjualan ${method}: ${sale.saleNo} - Rp ${Number(sale.totalAmount).toLocaleString()}`,
                targetId: String(sale.id), targetType: "StoreSale",
                newData: { saleNo: sale.saleNo, totalAmount: Number(sale.totalAmount), paymentMethod: method, memberId: body.memberId || null, unitType },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({
            data: {
                saleNo: sale.saleNo,
                totalAmount: Number(sale.totalAmount),
                cashReceived: Number(sale.cashReceived),
                changeAmount: Number(sale.changeAmount),
                paymentMethod: method,
                items: validatedItems.length,
            },
        }, { status: 201 });
    } catch (error: any) {
        console.error("POST /api/toko/sales error:", error);
        const errMsg = error?.message ? error.message : String(error);
        return NextResponse.json({ message: `Failed to process sale: ${errMsg}` }, { status: 500 });
    }
}
