import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// GET /api/mobile/payroll/my-slips — Current member's own slips
export async function GET(request: Request) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();

  try {
    if (!user.memberId) {
      return NextResponse.json(
        { message: "Data anggota tidak ditemukan" },
        { status: 404 }
      );
    }

    const slips = await prisma.payrollSlip.findMany({
      where: { memberId: parseInt(user.memberId) },
      include: {
        period: {
          select: { id: true, periodName: true, periodMonth: true, periodYear: true },
        },
      },
      orderBy: [{ period: { periodYear: "desc" } }, { period: { periodMonth: "desc" } }],
    });

    return NextResponse.json({ data: slips });
  } catch (error) {
    console.error("GET /api/mobile/payroll/my-slips error:", error);
    return NextResponse.json(
      { message: "Gagal memuat slip gaji" },
      { status: 500 }
    );
  }
}
