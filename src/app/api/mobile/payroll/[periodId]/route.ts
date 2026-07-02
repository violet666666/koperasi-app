import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

interface Params {
  params: Promise<{ periodId: string }>;
}

// GET /api/mobile/payroll/[periodId] — Period detail with all slips (operator/admin only)
export async function GET(request: Request, { params }: Params) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();

  if (!["operator", "admin", "admin_sp"].includes(user.role)) {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  try {
    const { periodId } = await params;
    const id = parseInt(periodId);
    if (isNaN(id))
      return NextResponse.json(
        { message: "ID periode tidak valid" },
        { status: 400 }
      );

    const period = await prisma.payrollPeriod.findUnique({
      where: { id },
      include: {
        slips: {
          orderBy: { nama: "asc" },
          include: {
            member: {
              select: { id: true, nrp: true, name: true },
            },
          },
        },
      },
    });

    if (!period) {
      return NextResponse.json(
        { message: "Periode gaji tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: period });
  } catch (error) {
    console.error("GET /api/mobile/payroll/[periodId] error:", error);
    return NextResponse.json(
      { message: "Gagal memuat detail periode gaji" },
      { status: 500 }
    );
  }
}
