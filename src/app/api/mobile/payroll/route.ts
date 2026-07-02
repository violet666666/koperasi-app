import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

// GET /api/mobile/payroll — List all payroll periods (operator/admin only)
export async function GET(request: Request) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();

  if (!["operator", "admin", "admin_sp"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const periods = await prisma.payrollPeriod.findMany({
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }],
      include: { _count: { select: { slips: true } } },
    });

    return NextResponse.json({
      data: periods.map((p) => ({
        id: p.id,
        name: p.periodName,
        month: p.periodMonth,
        year: p.periodYear,
        status: p.status,
        slipCount: p._count.slips,
        createdAt: p.createdAt,
      })),
    });
  } catch (error) {
    console.error("GET /api/mobile/payroll error:", error);
    return NextResponse.json(
      { message: "Gagal memuat data periode gaji" },
      { status: 500 }
    );
  }
}
