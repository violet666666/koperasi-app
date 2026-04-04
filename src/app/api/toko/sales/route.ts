import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// GET /api/toko/sales - List sales with items
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "100");

        const sales = await prisma.storeSale.findMany({
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
            data: sales.map((s) => ({
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
        const body = await request.json();
        const { items, customerName, paymentMethod, cashReceived, createdById, memberId } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang kosong" }, { status: 400 });
        }

        const userId = createdById || 1;

        // Validate stock and calculate total
        let totalAmount = 0;
        const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number }[] = [];

        for (const item of items) {
            const product = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
            if (!product) {
                return NextResponse.json({ message: `Produk ID ${item.productId} tidak ditemukan` }, { status: 404 });
            }
            if (product.stock < item.quantity) {
                return NextResponse.json({ message: `Stok ${product.name} tidak mencukupi (sisa: ${product.stock})` }, { status: 400 });
            }

            const unitPrice = Number(product.sellPrice);
            const subtotal = unitPrice * item.quantity;
            totalAmount += subtotal;

            validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal });
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
        } else if (method === "credit") {
            // Credit: validate member exists
            if (!memberId) {
                return NextResponse.json({ message: "Member ID diperlukan untuk pembayaran kredit" }, { status: 400 });
            }
            const member = await prisma.member.findUnique({ where: { id: memberId } });
            if (!member) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }
            payment = 0;
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

        // Create journal entry
        const journalCount = await prisma.journal.count();
        const journalNo = `JRN-${now.getFullYear()}${String(journalCount + 1).padStart(5, "0")}`;

        const kasAccount = await prisma.account.findFirst({ where: { code: "1101" } });
        const piutangTokoAccount = await prisma.account.findFirst({ where: { code: "1301" } }); // Piutang Toko
        const tokoIncomeAccount = await prisma.account.findFirst({ where: { code: "4201" } });
        const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });

        let journalId: number | null = null;

        if (tokoIncomeAccount && headOffice && currentPeriod) {
            const debitAccountId = method === "credit"
                ? (piutangTokoAccount?.id || kasAccount?.id)
                : kasAccount?.id;

            if (debitAccountId) {
                const journal = await prisma.journal.create({
                    data: {
                        journalNo,
                        branchId: headOffice.id,
                        transactionDate: now,
                        description: `Penjualan Toko ${method === "credit" ? "(Kredit)" : "(Tunai)"} - ${saleNo}`,
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
                            description: method === "credit"
                                ? "Piutang toko (potong gaji)"
                                : "Kas masuk penjualan toko",
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

        // Create sale record
        const sale = await prisma.storeSale.create({
            data: {
                saleNo,
                memberId: method === "credit" ? memberId : null,
                customerName: customerName || null,
                totalAmount,
                paymentMethod: method,
                cashReceived: method === "cash" ? payment : 0,
                changeAmount,
                journalId,
                periodId: currentPeriod?.id || null,
                createdById: userId,
                items: {
                    create: validatedItems.map((vi) => ({
                        productId: vi.productId,
                        quantity: vi.quantity,
                        unitPrice: vi.unitPrice,
                        subtotal: vi.subtotal,
                    })),
                },
            },
            include: { items: { include: { product: true } } },
        });

        // Deduct stock
        for (const vi of validatedItems) {
            await prisma.storeProduct.update({
                where: { id: vi.productId },
                data: { stock: { decrement: vi.quantity } },
            });
        }

        // ============================================================
        // FIX K-1: Sinkronisasi Kas Fisik (Tunai)
        // Saat penjualan tunai, uang masuk harus dicatat ke CashBankTransaction
        // agar saldo Kas & Buku Kas terupdate secara real-time.
        // ============================================================
        if (method === "cash") {
            try {
                // Temukan rekening kas utama (kas kecil / kas toko)
                const kasAccount = await prisma.cashBankAccount.findFirst({
                    where: { type: "cash", isActive: true },
                    orderBy: { id: "asc" },
                });

                if (kasAccount) {
                    const currentBal = Number(kasAccount.currentBalance);
                    const newBal = currentBal + totalAmount;

                    // Catat transaksi masuk di Buku Kas
                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: `TK-KAS-${Date.now().toString(36).toUpperCase()}`,
                            accountId: kasAccount.id,
                            branchId: kasAccount.branchId,
                            type: "in",
                            category: "pendapatan_toko",
                            amount: totalAmount,
                            balanceBefore: currentBal,
                            balanceAfter: newBal,
                            description: `Penjualan Toko Tunai - ${saleNo}`,
                            transactionDate: now,
                            createdById: userId,
                        },
                    });

                    // Update saldo rekening kas
                    await prisma.cashBankAccount.update({
                        where: { id: kasAccount.id },
                        data: { currentBalance: newBal },
                    });
                }
            } catch (cashErr) {
                // Jangan batalkan transaksi — hanya log agar tidak merusak checkout
                console.error("[K-1] Gagal sinkronisasi kas tunai toko:", cashErr);
            }
        }

        // ============================================================
        // FIX K-3: Buat Tagihan Piutang Toko (Kredit / Potong Gaji)
        // Saat penjualan kredit, sistem harus otomatis membuat tagihan
        // UnitTransaction dengan isPaid:false agar dapat ditagih admin.
        // ============================================================
        if (method === "credit" && memberId) {
            try {
                const memberForCredit = await prisma.member.findUnique({ where: { id: memberId } });
                if (memberForCredit) {
                    await prisma.unitTransaction.create({
                        data: {
                            transactionNo: `TK-UTG-${Date.now().toString(36).toUpperCase()}`,
                            memberId: memberId,
                            unitType: "toko",
                            description: `Piutang Toko (Kredit) - ${saleNo}`,
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
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Toko",
                description: `Penjualan ${method === 'credit' ? 'kredit' : 'tunai'}: ${sale.saleNo} - Rp ${Number(sale.totalAmount).toLocaleString()}`,
                targetId: String(sale.id), targetType: "StoreSale",
                newData: { saleNo: sale.saleNo, totalAmount: Number(sale.totalAmount), paymentMethod: method, memberId: body.memberId || null },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({
            data: {
                saleNo: sale.saleNo,
                totalAmount: Number(sale.totalAmount),
                cashReceived: Number(sale.cashReceived),
                changeAmount: Number(sale.changeAmount),
                paymentMethod: method,
                items: sale.items.length,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/toko/sales error:", error);
        return NextResponse.json({ message: "Failed to process sale" }, { status: 500 });
    }
}
