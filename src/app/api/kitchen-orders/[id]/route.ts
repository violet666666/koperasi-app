import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isValidStatusTransition } from "@/lib/kds";

export const dynamic = "force-dynamic";

const ALLOWED_KDS_ROLES = ["admin", "operator", "kasir"];

// PATCH /api/kitchen-orders/[id] — Update order status
export async function PATCH(
    req: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_KDS_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await req.json();
        const { status } = body;

        if (!status) {
            return NextResponse.json({ message: "status is required" }, { status: 400 });
        }

        const order = await prisma.kitchenOrder.findUnique({ where: { id } });
        if (!order) {
            return NextResponse.json({ message: "Order not found" }, { status: 404 });
        }

        if (!isValidStatusTransition(order.status, status)) {
            return NextResponse.json(
                { message: `Invalid transition: ${order.status} → ${status}` },
                { status: 400 }
            );
        }

        const timestampField: Record<string, string> = {
            preparing: "startedAt",
            ready: "completedAt",
            served: "servedAt",
        };

        const updated = await prisma.kitchenOrder.update({
            where: { id },
            data: {
                status,
                ...(timestampField[status] ? { [timestampField[status]]: new Date() } : {}),
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("[KDS] PATCH error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
