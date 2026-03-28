import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// GET /api/mobile/toko?search=xxx — List store products
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";

    try {
        const where: any = { isActive: true, deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
            ];
        }

        const products = await prisma.storeProduct.findMany({
            where,
            select: { id: true, sku: true, name: true, sellPrice: true, stock: true, unit: true, category: true },
            orderBy: { name: "asc" },
            take: 50,
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id, sku: p.sku, name: p.name,
                price: Number(p.sellPrice), stock: p.stock, unit: p.unit, category: p.category,
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/toko error:", error);
        return NextResponse.json({ message: "Gagal memuat produk" }, { status: 500 });
    }
}

// POST /api/mobile/toko — Process checkout via StoreSale
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "kasir" && user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { items, paymentMethod, memberId, customerName } = body;

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json({ message: "Keranjang belanja kosong" }, { status: 400 });
        }
        if (!paymentMethod || !["cash", "credit"].includes(paymentMethod)) {
            return NextResponse.json({ message: "Metode pembayaran harus cash atau credit" }, { status: 400 });
        }
        if (paymentMethod === "credit" && !memberId) {
            return NextResponse.json({ message: "memberId wajib untuk pembayaran kredit" }, { status: 400 });
        }

        // Validate products and calculate total
        let total = 0;
        const productUpdates: { id: number; newStock: number }[] = [];
        const validatedItems: { productId: number; quantity: number; sellPrice: number; subtotal: number }[] = [];

        for (const item of items) {
            const product = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
            if (!product || !product.isActive) {
                return NextResponse.json({ message: `Produk ID ${item.productId} tidak ditemukan` }, { status: 404 });
            }
            if (product.stock < item.quantity) {
                return NextResponse.json({ message: `Stok ${product.name} tidak cukup (sisa: ${product.stock})` }, { status: 400 });
            }
            const subtotal = Number(product.sellPrice) * item.quantity;
            total += subtotal;
            productUpdates.push({ id: product.id, newStock: product.stock - item.quantity });
            validatedItems.push({ productId: product.id, quantity: item.quantity, sellPrice: Number(product.sellPrice), subtotal });
        }

        const saleNo = `POS-M-${Date.now()}`;

        // Create sale + update stocks atomically
        const txOps: any[] = [];

        // Reduce stock
        for (const pu of productUpdates) {
            txOps.push(prisma.storeProduct.update({ where: { id: pu.id }, data: { stock: pu.newStock } }));
        }

        // Create StoreSale with items
        txOps.push(
            prisma.storeSale.create({
                data: {
                    saleNo,
                    memberId: memberId ? Number(memberId) : null,
                    customerName: customerName || null,
                    totalAmount: total,
                    paymentMethod,
                    cashReceived: paymentMethod === "cash" ? total : null,
                    changeAmount: paymentMethod === "cash" ? 0 : null,
                    createdById: Number(user.id),
                    items: {
                        create: validatedItems.map((vi) => ({
                            productId: vi.productId,
                            quantity: vi.quantity,
                            unitPrice: vi.sellPrice,
                            subtotal: vi.subtotal,
                        })),
                    },
                },
            })
        );

        await prisma.$transaction(txOps);

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "CREATE",
            module: "Toko",
            description: `Checkout ${paymentMethod} Rp ${total.toLocaleString("id-ID")} (${items.length} item) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: "Checkout berhasil! 🛒",
            data: { total, paymentMethod, itemCount: items.length, saleNo },
        });
    } catch (error) {
        console.error("POST /api/mobile/toko error:", error);
        return NextResponse.json({ message: "Gagal memproses checkout" }, { status: 500 });
    }
}
