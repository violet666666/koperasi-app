import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";
import { isValidStatusTransition, validateKitchenOrder } from "@/lib/kds";

export const dynamic = "force-dynamic";

const ALLOWED_KDS_ROLES = ["admin", "operator", "kasir"];

// GET /api/kitchen-orders — List orders for KDS display
// Query params: unitType, status, limit
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_KDS_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const userUnitType = (session.user as { unitType?: string }).unitType || null;
        const unitType = searchParams.get("unitType") || userUnitType;
        if (role !== "operator" && userUnitType && !isSameUnit(unitType, userUnitType)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        const status = searchParams.get("status");
        const limit = parseInt(searchParams.get("limit") || "50");

        const where: any = {};
        if (unitType) where.unitType = unitType;
        if (status) where.status = status;

        const orders = await prisma.kitchenOrder.findMany({
            where,
            orderBy: { createdAt: "asc" },
            take: limit,
        });

        return NextResponse.json({ data: orders });
    } catch (error) {
        console.error("[KDS] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// POST /api/kitchen-orders — Create new kitchen order (called from POS on checkout)
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_KDS_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validation = validateKitchenOrder(body);
        if (!validation.valid) {
            return NextResponse.json({ message: validation.errors.join(", ") }, { status: 400 });
        }

        const order = await prisma.kitchenOrder.create({
            data: {
                unitType: body.unitType,
                orderType: body.orderType || "dine_in",
                saleId: body.saleId || null,
                tableNumber: body.tableNumber || null,
                queueNumber: body.queueNumber || null,
                items: body.items,
                notes: body.notes || null,
                status: "pending",
            },
        });

        return NextResponse.json({ data: order }, { status: 201 });
    } catch (error) {
        console.error("[KDS] POST error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
