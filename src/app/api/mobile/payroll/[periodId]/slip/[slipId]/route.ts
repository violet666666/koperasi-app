import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";

interface Params {
  params: Promise<{ periodId: string; slipId: string }>;
}

// GET /api/mobile/payroll/[periodId]/slip/[slipId] — Individual slip detail
export async function GET(request: Request, { params }: Params) {
  const mobileUser = await getMobileUserWithScope(request);
  if (!mobileUser) return unauthorizedResponse();

  // Anggota: self-only access (existing path, unchanged).
  // Staff roles: gate + branch scope.
  const role = mobileUser.role;
  if (
    role !== "anggota" &&
    role !== "operator" &&
    role !== "admin" &&
    role !== "admin_sp" &&
    role !== "kasir"
  ) {
    return NextResponse.json(
      { message: "Akses ditolak" },
      { status: 403 }
    );
  }

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
          select: { id: true, nrp: true, name: true, pangkat: true, kesatuan: true, branchId: true },
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
    if (role === "anggota") {
      if (!mobileUser.memberId || slip.memberId !== mobileUser.memberId) {
        return NextResponse.json(
          { message: "Anda tidak memiliki akses ke slip ini" },
          { status: 403 }
        );
      }
    } else if (role !== "operator") {
      // Non-operator staff: branch scope check.
      // memberId is nullable — if the slip has no linked member, branch is
      // unknowable, so fail-closed (deny) for non-operator staff.
      const memberBranchId = slip.member?.branchId;
      if (memberBranchId == null || !canAccessBranch(mobileUser, memberBranchId).allowed) {
        return NextResponse.json(
          { message: "Akses ditolak: resource di luar scope anda." },
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
