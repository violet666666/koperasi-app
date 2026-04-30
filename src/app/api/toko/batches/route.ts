import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createNotification } from "@/lib/notifications";

export const dynamic = "force-dynamic";

// GET /api/toko/batches — List/filter batches
// Query params: view (active|expired|expiring_soon|all), unitType, page, limit
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const view = searchParams.get("view") || "active";
        const unitType = searchParams.get("unitType") || "toko";
        const page = parseInt(searchParams.get("page") || "1");
        const limit = parseInt(searchParams.get("limit") || "50");
        const search = searchParams.get("search") || "";

        const now = new Date();
        const ninetyDaysFromNow = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        // Auto-expire batches whose expiryDate has passed
        const expiredResult = await prisma.stockBatch.updateMany({
            where: {
                expiryDate: { lt: now },
                isActive: true,
                quantity: { gt: 0 },
            },
            data: { isActive: false },
        });

        // Notify about newly auto-expired batches only
        if (expiredResult.count > 0) {
            try {
                // Only get batches that were just expired (isActive just set to false, still have stock)
                const newlyExpired = await prisma.stockBatch.findMany({
                    where: {
                        isActive: false,
                        quantity: { gt: 0 },
                        expiryDate: { lt: now },
                        unitType,
                    },
                    include: { product: { select: { name: true } } },
                    take: 20,
                    orderBy: { expiryDate: "desc" },
                });
                const admins = await prisma.user.findMany({
                    where: { role: { name: { in: ["admin", "operator", "super_admin"] } }, isActive: true },
                    select: { id: true },
                });
                if (admins.length > 0) {
                    for (const batch of newlyExpired) {
                        // Deduplicate: skip if already notified about this batch
                        const existing = await prisma.notification.findFirst({
                            where: {
                                type: "batch_expired",
                                data: { path: ["batchId"], equals: batch.id },
                            },
                        });
                        if (!existing) {
                            await createNotification({
                                userId: admins.map((a) => a.id),
                                type: "batch_expired",
                                title: "Batch Expired",
                                message: `${batch.product?.name || "Produk"} batch ${batch.batchNo || batch.id} sudah kadaluarsa`,
                                data: { batchId: batch.id, productId: batch.productId, unitType: batch.unitType },
                            });
                        }
                    }
                }
            } catch (e) { /* non-critical */ }
        }

        // Check for expiring-soon batches (within 90 days) and notify
        if (view === "active" || view === "all") {
            try {
                const expiringSoon = await prisma.stockBatch.findMany({
                    where: {
                        expiryDate: { gte: now, lte: ninetyDaysFromNow },
                        isActive: true,
                        quantity: { gt: 0 },
                        unitType,
                    },
                    include: { product: { select: { name: true } } },
                });
                if (expiringSoon.length > 0) {
                    const admins = await prisma.user.findMany({
                        where: { role: { name: { in: ["admin", "operator", "super_admin"] } }, isActive: true },
                        select: { id: true },
                    });
                    if (admins.length > 0) {
                        for (const batch of expiringSoon.slice(0, 5)) {
                            const daysLeft = Math.ceil((batch.expiryDate!.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                            // Only notify if we haven't already (check if notification exists for this batch)
                            const existing = await prisma.notification.findFirst({
                                where: {
                                    type: "expiring_soon",
                                    data: { path: ["batchId"], equals: batch.id },
                                    createdAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) },
                                },
                            });
                            if (!existing) {
                                await createNotification({
                                    userId: admins.map((a) => a.id),
                                    type: "expiring_soon",
                                    title: "Batch Hampir Expired",
                                    message: `${batch.product?.name || "Produk"} batch ${batch.batchNo || batch.id} — ${daysLeft} hari lagi`,
                                    data: { batchId: batch.id, productId: batch.productId, daysLeft, unitType: batch.unitType },
                                });
                            }
                        }
                    }
                }
            } catch (e) { /* non-critical */ }
        }

        // Build query based on view
        const where: any = { unitType };

        if (search) {
            where.OR = [
                { batchNo: { contains: search, mode: "insensitive" } },
                { supplierName: { contains: search, mode: "insensitive" } },
                { product: { name: { contains: search, mode: "insensitive" } } },
            ];
        }

        switch (view) {
            case "active":
                where.isActive = true;
                where.quantity = { gt: 0 };
                break;
            case "expired":
                where.expiryDate = { lt: now };
                where.quantity = { gt: 0 };
                break;
            case "expiring_soon":
                where.expiryDate = { gte: now, lte: ninetyDaysFromNow };
                where.isActive = true;
                where.quantity = { gt: 0 };
                break;
            // "all" — no additional filters
        }

        const [batches, total] = await Promise.all([
            prisma.stockBatch.findMany({
                where,
                include: {
                    product: { select: { id: true, name: true, sku: true, unit: true } },
                },
                orderBy: { receivedAt: "desc" },
                skip: (page - 1) * limit,
                take: limit,
            }),
            prisma.stockBatch.count({ where }),
        ]);

        return NextResponse.json({
            data: batches.map((b) => ({
                id: b.id,
                batchNo: b.batchNo,
                productId: b.productId,
                productName: b.product?.name,
                productSku: b.product?.sku,
                productUnit: b.product?.unit,
                purchasePrice: Number(b.purchasePrice),
                quantity: b.quantity,
                originalQuantity: b.originalQuantity,
                expiryDate: b.expiryDate,
                supplierName: b.supplierName,
                location: b.location,
                isActive: b.isActive,
                notes: b.notes,
                receivedAt: b.receivedAt,
                createdAt: b.createdAt,
            })),
            total,
            page,
            totalPages: Math.ceil(total / limit),
            autoExpiredCount: expiredResult.count,
        });
    } catch (error) {
        console.error("[Batches] GET error:", error);
        return NextResponse.json({ message: "Gagal mengambil data batch" }, { status: 500 });
    }
}
