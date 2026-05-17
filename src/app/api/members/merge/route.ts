import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit } from "@/lib/audit-logger";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "super_admin"];

// POST /api/members/merge — Merge source member into target, then soft-delete source
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sourceId, targetId } = body;

    if (!sourceId || !targetId) {
      return NextResponse.json(
        { message: "sourceId dan targetId wajib diisi." },
        { status: 400 }
      );
    }

    if (sourceId === targetId) {
      return NextResponse.json(
        { message: "Source dan target tidak boleh sama." },
        { status: 400 }
      );
    }

    const [source, target] = await Promise.all([
      prisma.member.findUnique({
        where: { id: Number(sourceId), deletedAt: null },
        include: { userAccount: true },
      }),
      prisma.member.findUnique({
        where: { id: Number(targetId), deletedAt: null },
        include: { userAccount: true },
      }),
    ]);

    if (!source) {
      return NextResponse.json({ message: "Member source tidak ditemukan." }, { status: 404 });
    }
    if (!target) {
      return NextResponse.json({ message: "Member target tidak ditemukan." }, { status: 404 });
    }

    const ts = Date.now();

    await prisma.$transaction(async (tx) => {
      // 1. Reassign all child records from source to target
      await Promise.all([
        tx.savingsAccount.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.savingsTransaction.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.loan.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.loanApplication.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.loanPayment.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.unitTransaction.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.storeSale.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.receipt.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.cashBankTransaction.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.shuDistribution.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.tabunganSejahteraHistory.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.billingItem.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
        tx.payrollSlip.updateMany({ where: { memberId: source.id }, data: { memberId: target.id } }),
      ]);

      // 2. Free unique constraints on source
      await tx.member.update({
        where: { id: source.id },
        data: {
          memberNo: `${source.memberNo}_merged_${source.id}_${ts}`,
          nrp: source.nrp ? `${source.nrp}_merged_${source.id}_${ts}` : null,
          nik: source.nik ? `${source.nik}_merged_${source.id}_${ts}` : null,
        },
      });

      // 3. Soft-delete source
      await tx.member.update({
        where: { id: source.id },
        data: {
          deletedAt: new Date(),
          status: "merged",
        },
      });

      // 4. Deactivate source's User account
      if (source.userAccount) {
        await tx.user.update({
          where: { id: source.userAccount.id },
          data: { isActive: false, deletedAt: new Date() },
        });
      }
    });

    // Audit log
    await logAudit({
      userId: Number(session.user.id),
      userName: session.user.name || "Unknown",
      userRole: session.user.role,
      action: "DELETE",
      module: "Anggota",
      description: `Merge member #${source.id} (${source.name}) → #${target.id} (${target.name})`,
      targetId: source.id,
      targetType: "member",
      metadata: { sourceId: source.id, targetId: target.id, sourceNrp: source.nrp, targetNrp: target.nrp },
    });

    return NextResponse.json({
      message: `Member "${source.name}" berhasil digabung ke "${target.name}". Semua data telah dipindahkan.`,
      data: { sourceId: source.id, targetId: target.id },
    });
  } catch (error: any) {
    console.error("POST /api/members/merge error:", error);
    return NextResponse.json(
      { message: `Gagal merge member: ${error?.message || "Terjadi kesalahan."}` },
      { status: 500 }
    );
  }
}
