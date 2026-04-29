import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/toko/shifts/[id]/sales — Ambil semua transaksi dalam shift
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const shiftId = parseInt(id);

        const sessionUser = await prisma.user.findUnique({
            where: { id: Number(session.user.id) },
            include: { role: true },
        });

        const shift = await prisma.cashierShift.findUnique({
            where: { id: shiftId },
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        if (!shift) {
            return NextResponse.json({ message: "Shift tidak ditemukan" }, { status: 404 });
        }

        // Access control
        const role = sessionUser?.role?.name;
        const isKasir = role === "kasir";
        const isAdmin = role === "admin";
        const isOperator = role === "operator";
        const isOwner = shift.userId === Number(session.user.id);

        if (isKasir && !isOwner) {
            return NextResponse.json({ message: "Anda tidak memiliki akses" }, { status: 403 });
        }
        if (isAdmin && shift.unitType !== sessionUser?.unitType) {
            return NextResponse.json({ message: "Anda tidak memiliki akses" }, { status: 403 });
        }
        if (!isKasir && !isAdmin && !isOperator) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        // Fetch all StoreSales in this shift with items
        const sales = await prisma.storeSale.findMany({
            where: { shiftId },
            include: {
                member: { select: { id: true, name: true, memberNo: true } },
                items: {
                    include: {
                        product: { select: { id: true, name: true, sku: true } },
                    },
                },
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { createdAt: "desc" },
        });

        // Build response with void metadata
        const salesData = sales.map((s: any) => {
            const meta = s.metadata
                ? (typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata)
                : {};
            return {
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
                items: s.items.map((i: any) => ({
                    id: i.id,
                    product: i.product,
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    subtotal: Number(i.subtotal),
                })),
                isVoided: !!meta.isVoided,
                voidReason: meta.voidReason || null,
            };
        });

        // Aggregate stats (exclude voided)
        const activeSales = salesData.filter((s: any) => !s.isVoided);
        const totalCash = activeSales.filter((s: any) => s.paymentMethod === "cash").reduce((s: number, t: any) => s + t.totalAmount, 0);
        const totalQris = activeSales.filter((s: any) => s.paymentMethod === "qris").reduce((s: number, t: any) => s + t.totalAmount, 0);
        const totalCredit = activeSales.filter((s: any) => s.paymentMethod === "salary_cut").reduce((s: number, t: any) => s + t.totalAmount, 0);

        // Top products
        const productMap = new Map<string, { name: string; sku: string; qty: number; revenue: number }>();
        for (const sale of activeSales) {
            for (const item of sale.items) {
                const key = item.product.name;
                const existing = productMap.get(key) || { name: item.product.name, sku: item.product.sku, qty: 0, revenue: 0 };
                existing.qty += item.quantity;
                existing.revenue += item.subtotal;
                productMap.set(key, existing);
            }
        }
        const topProducts = [...productMap.values()]
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        return NextResponse.json({
            data: {
                shift: {
                    id: shift.id,
                    shiftName: shift.shiftName,
                    userName: shift.user.name,
                    startedAt: shift.startedAt.toISOString(),
                    endedAt: shift.endedAt?.toISOString() || null,
                    openingCash: Number(shift.openingCash),
                    closingCash: shift.closingCash ? Number(shift.closingCash) : null,
                    expectedCash: shift.expectedCash ? Number(shift.expectedCash) : null,
                    totalSalesCash: Number(shift.totalSalesCash),
                    totalSalesQris: Number(shift.totalSalesQris),
                    totalSalesCredit: Number(shift.totalSalesCredit),
                    totalTransactions: shift.totalTransactions,
                    cashDifference: shift.cashDifference ? Number(shift.cashDifference) : null,
                    notes: shift.notes,
                    status: shift.status,
                },
                sales: salesData,
                summary: {
                    totalSales: salesData.length,
                    activeSales: activeSales.length,
                    voidedSales: salesData.length - activeSales.length,
                    totalCash,
                    totalQris,
                    totalCredit,
                    totalRevenue: totalCash + totalQris + totalCredit,
                },
                topProducts,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/shifts/[id]/sales error:", error);
        return NextResponse.json({ message: "Gagal mengambil data transaksi shift" }, { status: 500 });
    }
}
