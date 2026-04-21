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
        
        // Optional filter if you only want products strictly mapped to this unitType
        if (unitType) {
            where.unitType = unitType;
        }

        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }

        const products = await prisma.storeProduct.findMany({
            where,
            select: { id: true, sku: true, name: true, sellPrice: true, stock: true, unit: true, category: true, unitType: true },
            orderBy: { name: "asc" },
            take: 50,
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id, sku: p.sku, name: p.name,
                price: Number(p.sellPrice), stock: p.stock, unit: p.unit, category: p.category, unitType: p.unitType
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/toko error:", error);
        return NextResponse.json({ message: "Gagal memuat produk" }, { status: 500 });
    }
}

// POST /api/mobile/toko — Process checkout via StoreSale dengan Sinkronisasi Jurnal
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
        
        const method = paymentMethod === "credit" ? "salary_cut" : paymentMethod; // Legacy map

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        let totalAmount = 0;
        const productUpdates: { id: number; newStock: number }[] = [];
        const validatedItems: { productId: number; quantity: number; unitPrice: number; subtotal: number; productName: string }[] = [];

        for (const item of items) {
            const product = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
            if (!product || !product.isActive) {
                return NextResponse.json({ message: `Produk ID ${item.productId} tidak ditemukan` }, { status: 404 });
            }
            if (product.stock < item.quantity) {
                return NextResponse.json({ message: `Stok ${product.name} tidak cukup` }, { status: 400 });
            }
            const unitPrice = Number(product.sellPrice);
            const subtotal = unitPrice * item.quantity;
            totalAmount += subtotal;
            
            productUpdates.push({ id: product.id, newStock: product.stock - item.quantity });
            validatedItems.push({ productId: product.id, quantity: item.quantity, unitPrice, subtotal, productName: product.name });
        }

        const now = new Date();
        const saleNo = `POS-M-${now.getFullYear()}${String(now.getMonth()+1).padStart(2,"0")}${String(now.getDate()).padStart(2,"0")}-${Date.now().toString(36).toUpperCase()}`;
        const userId = Number(user.id);

        let payment = method === "cash" || method === "qris" ? totalAmount : 0;
        let changeAmount = 0; // Simplified for mobile

        // Start creating operations...
        const txOps: any[] = [];

        for (const pu of productUpdates) {
            txOps.push(prisma.storeProduct.update({ where: { id: pu.id }, data: { stock: pu.newStock } }));
        }

        txOps.push(
            prisma.storeSale.create({
                data: {
                    saleNo,
                    memberId: method === "salary_cut" ? Number(memberId) : null,
                    unitType,
                    customerName: customerName || null,
                    totalAmount,
                    paymentMethod: method,
                    cashReceived: payment,
                    changeAmount,
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
            })
        );

        await prisma.$transaction(txOps);
        
        // Asynchronous non-blocking hooks for journaling & cash bank
        try {
            if (method === "cash" || method === "qris") {
                const targetAccount = await prisma.cashBankAccount.findFirst({
                    where: { type: method === "cash" ? "cash" : "bank", unitType, isActive: true },
                    orderBy: { id: "asc" },
                });
                if (targetAccount) {
                    const newBal = Number(targetAccount.currentBalance) + totalAmount;
                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: `MB-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                            accountId: targetAccount.id, branchId: targetAccount.branchId,
                            type: "in", category: "pendapatan_toko", amount: totalAmount,
                            balanceBefore: Number(targetAccount.currentBalance), balanceAfter: newBal,
                            unitType: unitType,
                            description: `Penjualan Mobile ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${saleNo}`,
                            transactionDate: now, createdById: userId,
                        },
                    });
                    await prisma.cashBankAccount.update({
                        where: { id: targetAccount.id }, data: { currentBalance: newBal },
                    });
                }
            } else if (method === "salary_cut" && memberId) {
                await prisma.unitTransaction.create({
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
        } catch (postFixErr) {
            console.error("Gagal menjalankan hook asinkron POS Mobile:", postFixErr);
        }

        await logAudit({
            userId: userId, userName: user.name,
            action: "CREATE", module: "Toko",
            description: `Checkout ${method} Rp ${totalAmount.toLocaleString("id-ID")} (${items.length} item) Unit ${unitType}`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: "Checkout berhasil! 🛒",
            data: { total: totalAmount, paymentMethod: method, itemCount: items.length, saleNo },
        });
    } catch (error) {
        console.error("POST /api/mobile/toko error:", error);
        return NextResponse.json({ message: "Gagal memproses checkout" }, { status: 500 });
    }
}
