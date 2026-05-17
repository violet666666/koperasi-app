import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/savings-accounts?search=xxx&page=1
// Operator-only: list all active savings accounts across all members
export async function GET(request: Request) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();
  if (
    user.role !== "operator" &&
    user.role !== "admin" &&
    user.role !== "admin_sp"
  ) {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }

  const url = new URL(request.url);
  const search = url.searchParams.get("search") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = 20;
  const skip = (page - 1) * limit;

  try {
    const memberWhere: Prisma.MemberWhereInput = {};
    if (search) {
      memberWhere.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { nrp: { contains: search, mode: "insensitive" } },
        { memberNo: { contains: search, mode: "insensitive" } },
      ];
    }

    const where: Prisma.SavingsAccountWhereInput = { status: "active" };
    if (search) {
      where.member = memberWhere;
    }

    const [accounts, total, aggregate] = await Promise.all([
      prisma.savingsAccount.findMany({
        where,
        include: {
          member: {
            select: { id: true, name: true, nrp: true, memberNo: true },
          },
          product: { select: { name: true, type: true } },
        },
        orderBy: [{ member: { name: "asc" } }],
        skip,
        take: limit,
      }),
      prisma.savingsAccount.count({ where }),
      prisma.savingsAccount.aggregate({
        where: { status: "active" },
        _sum: { balance: true },
        _count: { id: true },
      }),
    ]);

    // Per-product summary
    const productSummary = await prisma.savingsAccount.groupBy({
      by: ["productId"],
      where: { status: "active" },
      _sum: { balance: true },
      _count: { id: true },
    });

    const products = await prisma.savingsProduct.findMany({
      where: { id: { in: productSummary.map((p) => p.productId) } },
      select: { id: true, name: true, type: true },
    });

    const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

    return NextResponse.json({
      data: accounts.map((a) => ({
        id: a.id,
        accountNo: a.accountNo,
        memberName: a.member.name,
        memberNo: a.member.memberNo,
        nrp: a.member.nrp,
        memberId: a.member.id,
        productName: a.product.name,
        productType: a.product.type,
        balance: Number(a.balance),
      })),
      summary: {
        totalBalance: Number(aggregate._sum.balance || 0),
        totalAccounts: aggregate._count.id,
        byProduct: productSummary.map((p) => ({
          productName: productMap[p.productId]?.name || "Unknown",
          productType: productMap[p.productId]?.type || "",
          totalBalance: Number(p._sum.balance || 0),
          totalAccounts: p._count.id,
        })),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/mobile/savings-accounts error:", error);
    return NextResponse.json(
      { message: "Gagal memuat data rekening simpanan" },
      { status: 500 },
    );
  }
}
