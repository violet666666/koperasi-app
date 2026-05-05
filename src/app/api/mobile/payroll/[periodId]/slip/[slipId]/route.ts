import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../../middleware";

interface Params {
  params: Promise<{ periodId: string; slipId: string }>;
}

// GET /api/mobile/payroll/[periodId]/slip/[slipId] — Individual slip detail
export async function GET(request: Request, { params }: Params) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return unauthorizedResponse();

  try {
    const { slipId } = await params;
    const id = parseInt(slipId);
    if (isNaN(id))
      return NextResponse.json(
        { message: "ID slip tidak valid" },
        { status: 400 }
      );

    const slip = await prisma.payrollSlip.findUnique({
      where: { id },
      include: {
        period: true,
        member: {
          select: { id: true, nrp: true, name: true, pangkat: true, kesatuan: true },
        },
      },
    });

    if (!slip) {
      return NextResponse.json(
        { message: "Slip gaji tidak ditemukan" },
        { status: 404 }
      );
    }

    // Anggota role can only view their own slip
    if (mobileUser.role === "anggota") {
      const dbUser = await prisma.user.findUnique({
        where: { id: Number(mobileUser.id) },
        select: { memberId: true },
      });
      if (!dbUser?.memberId || slip.memberId !== dbUser.memberId) {
        return NextResponse.json(
          { message: "Anda tidak memiliki akses ke slip ini" },
          { status: 403 }
        );
      }
    }

    return NextResponse.json({ data: slip });
  } catch (error) {
    console.error("GET /api/mobile/payroll/[periodId]/slip/[slipId] error:", error);
    return NextResponse.json(
      { message: "Gagal memuat detail slip gaji" },
      { status: 500 }
    );
  }
}
