import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType } from "@/lib/constants/units";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitSlug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { unitSlug } = await params;
    const unitType = slugToUnitType(unitSlug);
    if (!unitType) {
      return NextResponse.json({ message: "Unit not found" }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const search = searchParams.get("search") || "";
    const skip = (page - 1) * limit;

    const where = {
      unitType,
      deletedAt: null,
      ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
    };

    const [products, total] = await Promise.all([
      prisma.storeProduct.findMany({
        where,
        select: {
          id: true,
          name: true,
          sellPrice: true,
          costPrice: true,
          stock: true,
          stockGdg: true,
          minStock: true,
          isActive: true,
          productType: true,
          trackStock: true,
          category: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.storeProduct.count({ where }),
    ]);

    return NextResponse.json({
      data: products,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("GET /api/manajemen-unit/[unitSlug]/products error:", error);
    return NextResponse.json({ message: "Failed to fetch products" }, { status: 500 });
  }
}
