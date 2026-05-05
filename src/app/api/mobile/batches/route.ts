import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        if (!["operator", "admin", "kasir"].includes(user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const view = searchParams.get("view") || "active";
        const search = searchParams.get("search");

        const conditions: any[] = [];

        // View filter
        if (view === "active") {
            conditions.push({ isActive: true, expiryDate: { gt: new Date() } });
        } else if (view === "expiring_soon") {
            const ninetyDays = new Date();
            ninetyDays.setDate(ninetyDays.getDate() + 90);
            conditions.push({ isActive: true, expiryDate: { lte: ninetyDays, gt: new Date() } });
        } else if (view === "expired") {
            conditions.push({ OR: [{ isActive: false }, { expiryDate: { lte: new Date() } }] });
        }

        // Search filter
        if (search) {
            conditions.push({
                OR: [
                    { batchNo: { contains: search, mode: "insensitive" } },
                    { supplierName: { contains: search, mode: "insensitive" } },
                    { product: { name: { contains: search, mode: "insensitive" } } },
                ],
            });
        }

        const where = conditions.length > 0 ? { AND: conditions } : {};

        const batches = await prisma.stockBatch.findMany({
            where,
            orderBy: { receivedAt: "desc" },
            take: 100,
            include: { product: { select: { name: true, sku: true } } },
        });

        return NextResponse.json({ data: batches });
    } catch (error) {
        console.error("GET /api/mobile/batches error:", error);
        return NextResponse.json({ message: "Gagal memuat data batch" }, { status: 500 });
    }
}
