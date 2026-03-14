import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// POST /api/toko/sales - Process a toko sale (checkout)
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { items, customerName, paymentMethod, cashReceived, createdById } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { message: "Keranjang kosong" },
                { status: 400 }
            );
        }

        // The createdById should come from session; default to 1 for demo
        const userId = createdById || 1;

        // Validate stock and calculate total
        let totalAmount = 0;
        const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number }[] = [];

        for (const item of items) {
            const product = await prisma.storeProduct.findUnique({
                where: { id: item.productId },
            });

            if (!product) {
                return NextResponse.json(
                    { message: `Produk ID ${item.productId} tidak ditemukan` },
                    { status: 404 }
                );
            }

            if (product.stock < item.quantity) {
                return NextResponse.json(
                    { message: `Stok ${product.name} tidak mencukupi (sisa: ${product.stock})` },
                    { status: 400 }
                );
            }

            const unitPrice = Number(product.sellPrice);
            const subtotal = unitPrice * item.quantity;
            totalAmount += subtotal;

            validatedItems.push({
                productId: product.id,
                quantity: item.quantity,
                unitPrice,
                subtotal,
            });
        }

        // Validate payment
        const payment = cashReceived || totalAmount;
        if (payment < totalAmount) {
            return NextResponse.json(
                { message: "Pembayaran kurang" },
                { status: 400 }
            );
        }

        const changeAmount = payment - totalAmount;

        // Generate sale number
        const now = new Date();
        const saleCount = await prisma.storeSale.count();
        const saleNo = `TK-${now.getFullYear()}${String(saleCount + 1).padStart(5, "0")}`;

        // Find current open fiscal period
        const currentPeriod = await prisma.fiscalPeriod.findFirst({
            where: { status: "open" },
            orderBy: { startDate: "desc" },
        });

        // Create journal entry (Debit Kas, Credit Pendapatan Toko)
        const journalCount = await prisma.journal.count();
        const journalNo = `JRN-${now.getFullYear()}${String(journalCount + 1).padStart(5, "0")}`;

        // Get account IDs
        const kasAccount = await prisma.account.findFirst({ where: { code: "1101" } });
        const tokoIncomeAccount = await prisma.account.findFirst({ where: { code: "4201" } });
        const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });

        let journalId: number | null = null;

        if (kasAccount && tokoIncomeAccount && headOffice && currentPeriod) {
            const journal = await prisma.journal.create({
                data: {
                    journalNo,
                    branchId: headOffice.id,
                    transactionDate: now,
                    description: `Penjualan Toko - ${saleNo}`,
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
                        accountId: kasAccount.id,
                        debit: totalAmount,
                        credit: 0,
                        description: "Kas masuk penjualan toko",
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

        // Create sale record
        const sale = await prisma.storeSale.create({
            data: {
                saleNo,
                customerName: customerName || null,
                totalAmount,
                paymentMethod: paymentMethod || "cash",
                cashReceived: payment,
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

        return NextResponse.json({
            data: {
                saleNo: sale.saleNo,
                totalAmount: Number(sale.totalAmount),
                cashReceived: Number(sale.cashReceived),
                changeAmount: Number(sale.changeAmount),
                items: sale.items.length,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/toko/sales error:", error);
        return NextResponse.json(
            { message: "Failed to process sale" },
            { status: 500 }
        );
    }
}
