import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { slugToUnitType, unitTypeFilter, storeSaleUnitTypeFilter } from "@/lib/constants/units";
import { computeWIBBoundaries } from "@/lib/services/manajemen-unit";

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
    const limit = parseInt(searchParams.get("limit") || "25");
    const skip = (page - 1) * limit;

    // Date range filter — uses computeWIBBoundaries for correct timezone handling
    const range = searchParams.get("range") ?? "today";
    const {
      todayStartUTC,
      todayDateUTC, tomorrowDateUTC,
    } = computeWIBBoundaries();

    const rangeDays = range === "30d" ? 30 : range === "7d" ? 7 : 1;
    const rangeStartUTC = rangeDays > 1
      ? new Date(todayStartUTC.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000)
      : todayStartUTC;
    const rangeStartDateUTC = rangeDays > 1
      ? new Date(todayDateUTC.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000)
      : todayDateUTC;

    const isStore = ["toko", "resto", "cafe_lsp"].includes(unitType);
    const utFilter = unitTypeFilter(unitType);
    const ssFilter = storeSaleUnitTypeFilter(unitType);

    if (isStore) {
      // Store transactions from StoreSale — alias-aware
      const [sales, total] = await Promise.all([
        prisma.storeSale.findMany({
          where: {
            unitType: ssFilter as string,
            createdAt: { gte: rangeStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
          select: {
            id: true,
            saleNo: true,
            totalAmount: true,
            paymentMethod: true,
            createdAt: true,
            metadata: true,
            items: {
              select: {
                quantity: true,
                unitPrice: true,
                product: { select: { name: true } },
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip,
          take: limit,
        }),
        prisma.storeSale.count({
          where: {
            unitType: ssFilter as string,
            createdAt: { gte: rangeStartUTC },
            NOT: { metadata: { path: ["isVoided"], equals: true } } as never,
          },
        }),
      ]);

      return NextResponse.json({
        data: sales.map((s) => ({
          id: s.id,
          transactionNo: s.saleNo,
          amount: Number(s.totalAmount),
          paymentMethod: s.paymentMethod,
          date: s.createdAt,
          items: s.items.map((i) => ({
            productName: i.product?.name ?? "Unknown",
            quantity: i.quantity,
            price: Number(i.unitPrice),
          })),
          type: "pos" as const,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    } else {
      // Service transactions from UnitTransaction — alias-aware, @db.Date field
      const [transactions, total] = await Promise.all([
        prisma.unitTransaction.findMany({
          where: {
            unitType: utFilter,
            transactionDate: { gte: rangeStartDateUTC, lt: tomorrowDateUTC },
            status: { not: "voided" },
          },
          select: {
            id: true,
            transactionNo: true,
            amount: true,
            description: true,
            paymentMethod: true,
            transactionDate: true,
            member: { select: { name: true } },
          },
          orderBy: { transactionDate: "desc" },
          skip,
          take: limit,
        }),
        prisma.unitTransaction.count({
          where: {
            unitType: utFilter,
            transactionDate: { gte: rangeStartDateUTC, lt: tomorrowDateUTC },
            status: { not: "voided" },
          },
        }),
      ]);

      return NextResponse.json({
        data: transactions.map((t) => ({
          id: t.id,
          transactionNo: t.transactionNo,
          amount: Number(t.amount),
          paymentMethod: t.paymentMethod,
          date: t.transactionDate,
          description: t.description,
          memberName: t.member?.name,
          type: "service" as const,
        })),
        pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      });
    }
  } catch (error) {
    console.error("GET /api/manajemen-unit/[unitSlug]/transactions error:", error);
    return NextResponse.json({ message: "Failed to fetch transactions" }, { status: 500 });
  }
}
