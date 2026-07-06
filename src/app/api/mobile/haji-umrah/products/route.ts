import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";
import { HAJI_UMRAH_TYPES } from "@/lib/services/haji-umrah-savings";

// GET /api/mobile/haji-umrah/products — List haji/umrah savings products
// VERBATIM mirror of web GET /api/haji-umrah/products (auth swapped for mobile JWT).
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    try {
        const products = await prisma.savingsProduct.findMany({
            where: {
                type: { in: HAJI_UMRAH_TYPES },
                deletedAt: null,
            },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({ data: products });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/products error:", error);
        return NextResponse.json(
            { message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}
