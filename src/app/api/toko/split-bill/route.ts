import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateSplitBill, calculateSplitTotal, generateSplitGroupId } from "@/lib/split-bill";

export const dynamic = "force-dynamic";

// POST /api/toko/split-bill — Process split payment (one order, multiple payment methods)
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await req.json();
        const { items, payments, unitType, customerName, tableNo, shiftId, splitGroupId: existingGroupId } = body;

        // Validate split
        const validation = validateSplitBill({ items, payments });
        if (!validation.valid) {
            return NextResponse.json({ message: "Invalid split bill", errors: validation.errors }, { status: 400 });
        }

        const groupId = existingGroupId || generateSplitGroupId();
        const results = [];

        // Create one StoreSale per payment method
        for (const payment of payments) {
            const saleNo = `SL-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

            // Calculate proportional item allocation for this payment slice
            const total = calculateSplitTotal(items);
            const ratio = payment.amount / total;
            const sliceItems = items.map(item => {
                // Allocate proportionally
                const allocatedQty = Math.max(1, Math.round(item.quantity * ratio));
                const allocatedSubtotal = Math.round(item.price * allocatedQty);
                return {
                    productId: item.productId,
                    quantity: allocatedQty,
                    unitPrice: item.price,
                    discount: 0,
                    subtotal: allocatedSubtotal,
                };
            });

            // Adjust last item subtotal to match payment amount exactly
            const sliceTotal = sliceItems.reduce((s: number, i: any) => s + i.subtotal, 0);
            if (sliceItems.length > 0 && sliceTotal !== payment.amount) {
                sliceItems[sliceItems.length - 1].subtotal += payment.amount - sliceTotal;
            }

            const metadata: any = {
                splitGroupId: groupId,
                splitPaymentMethod: payment.method,
                orderType: tableNo ? "dine_in" : "takeaway",
            };
            if (tableNo) metadata.tableNo = tableNo;
            if (payment.memberId) metadata.memberId = payment.memberId;

            const sale = await prisma.storeSale.create({
                data: {
                    saleNo,
                    unitType: unitType || "resto",
                    customerName: customerName || "Tamu",
                    totalAmount: payment.amount,
                    paymentMethod: payment.method,
                    cashReceived: payment.method === "cash" ? payment.amount : payment.amount,
                    changeAmount: 0,
                    metadata,
                    shiftId: shiftId || null,
                    createdById: parseInt(session.user.id),
                    items: {
                        create: sliceItems,
                    },
                },
                include: { items: true },
            });

            results.push(sale);
        }

        return NextResponse.json({
            message: "Split bill processed",
            splitGroupId: groupId,
            sales: results,
            totalSales: results.length,
        }, { status: 201 });
    } catch (error) {
        console.error("[SplitBill] POST error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
