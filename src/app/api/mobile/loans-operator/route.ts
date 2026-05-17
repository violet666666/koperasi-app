import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/loans-operator?status=active&search=xxx&page=1
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
  const statusFilter = url.searchParams.get("status") || "all";
  const search = url.searchParams.get("search") || "";
  const page = Math.max(1, Number(url.searchParams.get("page") || 1));
  const limit = 20;
  const skip = (page - 1) * limit;

  try {
    const where: Prisma.LoanWhereInput = {};

    if (statusFilter !== "all") {
      where.status = statusFilter;
    }

    if (search) {
      where.member = {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { nrp: { contains: search, mode: "insensitive" } },
          { memberNo: { contains: search, mode: "insensitive" } },
        ],
      };
    }

    const [loans, total] = await Promise.all([
      prisma.loan.findMany({
        where,
        include: {
          member: {
            select: { id: true, name: true, nrp: true, memberNo: true },
          },
          application: {
            select: { product: { select: { name: true } } },
          },
          payments: {
            orderBy: { paymentDate: "desc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.loan.count({ where }),
    ]);

    // Summary stats (global, not filtered by search)
    const summary = await prisma.loan.groupBy({
      by: ["status"],
      _count: { id: true },
      _sum: { principalOutstanding: true },
    });

    const summaryMap: Record<string, { count: number; outstanding: number }> =
      {};
    for (const s of summary) {
      summaryMap[s.status] = {
        count: s._count.id,
        outstanding: Number(s._sum.principalOutstanding || 0),
      };
    }

    return NextResponse.json({
      data: loans.map((l) => ({
        id: l.id,
        loanNo: l.loanNo,
        memberName: l.member.name,
        memberNo: l.member.memberNo,
        nrp: l.member.nrp,
        memberId: l.member.id,
        productName: l.application?.product?.name ?? "—",
        principalAmount: Number(l.principalAmount),
        principalOutstanding: Number(l.principalOutstanding),
        interestOutstanding: Number(l.interestOutstanding),
        monthlyInstallment: Number(l.monthlyInstallment),
        tenorMonths: l.tenorMonths,
        status: l.status,
        disbursementDate: l.disbursementDate,
        lastDueDate: l.lastDueDate,
        lastPaymentDate: l.payments[0]?.paymentDate ?? null,
      })),
      summary: summaryMap,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("GET /api/mobile/loans-operator error:", error);
    return NextResponse.json(
      { message: "Gagal memuat data pinjaman" },
      { status: 500 },
    );
  }
}
