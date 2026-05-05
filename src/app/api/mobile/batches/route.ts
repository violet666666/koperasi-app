import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const view = searchParams.get("view") || "active";
        const search = searchParams.get("search");

        const where: any = {};
        if (view === "active") {
            where.isActive = true;
            where.expiryDate = { gt: new Date() };
        } else if (view === "expiring_soon") {
            const ninetyDays = new Date();
            ninetyDays.setDate(ninetyDays.getDate() + 90);
            where.isActive = true;
            where.expiryDate = { lte: ninetyDays, gt: new Date() };
        } else if (view === "expired") {
            where.OR = [{ isActive: false }, { expiryDate: { lte: new Date() } }];
        }

        if (search) {
            where.OR = [
                { batchNo: { contains: search, mode: "insensitive" } },
                { supplierName: { contains: search, mode: "insensitive" } },
                { product: { name: { contains: search, mode: "insensitive" } } },
            ];
        }

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
