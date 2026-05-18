import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/toko/reports/sales-summary?unitType=resto&from=2026-05-01&to=2026-05-13
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const role = session.user.role as string;
        const ALLOWED_REPORT_ROLES = ["admin", "operator", "kasir"];
        if (!ALLOWED_REPORT_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const userUnitType = (session.user as { unitType?: string }).unitType || null;
        const unitType = searchParams.get("unitType") || userUnitType || "resto";
        if (role !== "operator" && userUnitType && unitType !== userUnitType) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        const sortBy = searchParams.get("sortBy") || "createdAt";
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

        const where: any = { unitType };
        if (from || to) {
            where.createdAt = {};
            if (from) where.createdAt.gte = new Date(from);
            if (to) where.createdAt.lte = new Date(new Date(to).setHours(23, 59, 59, 999));
        }
        // Exclude voided sales (use OR to include rows with null metadata or no isVoided key)
        where.OR = [
            { metadata: { equals: null } },
            { NOT: { metadata: { path: ["isVoided"], equals: true } } },
        ];

        const sales = await prisma.storeSale.findMany({
            where,
            include: { items: { include: { product: true } } },
            orderBy: { [sortBy]: sortOrder },
        });

        // Summary
        const totalRevenue = sales.reduce((sum, s) => sum + Number(s.totalAmount), 0);
        const transactionCount = sales.length;
        const byPayment: Record<string, number> = {};
        for (const sale of sales) {
            byPayment[sale.paymentMethod] = (byPayment[sale.paymentMethod] || 0) + Number(sale.totalAmount);
        }

        // Top products
        const productMap = new Map<string, { name: string; qty: number; revenue: number }>();
        for (const sale of sales) {
            for (const item of sale.items) {
                const key = String(item.productId);
                const existing = productMap.get(key);
                if (existing) {
                    existing.qty += item.quantity;
                    existing.revenue += Number(item.subtotal);
                } else {
                    productMap.set(key, {
                        name: item.product?.name || `Product #${item.productId}`,
                        qty: item.quantity,
                        revenue: Number(item.subtotal),
                    });
                }
            }
        }
        const topProducts = Array.from(productMap.entries())
            .map(([id, data]) => ({ productId: id, ...data }))
            .sort((a, b) => b.qty - a.qty)
            .slice(0, 10);

        return NextResponse.json({
            summary: { totalRevenue, transactionCount, byPayment },
            topProducts,
            sales: sales.map(s => ({
                id: s.id,
                saleNo: s.saleNo,
                customerName: s.customerName,
                totalAmount: Number(s.totalAmount),
                paymentMethod: s.paymentMethod,
                createdAt: s.createdAt,
                items: s.items.map(i => ({
                    productName: i.product?.name,
                    quantity: i.quantity,
                    subtotal: Number(i.subtotal),
                })),
            })),
        });
    } catch (error) {
        console.error("[Reports] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
