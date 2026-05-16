import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// POST /api/loans/sync-installment
// Sync monthlyInstallment to match actual LoanSchedule amounts for all active loans.
export async function POST() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const roleName =
      typeof session.user.role === "string"
        ? session.user.role
        : (session.user.role as any)?.name;
    if (roleName !== "operator") {
      return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const loans = await prisma.loan.findMany({
      where: { status: "active" },
      select: {
        id: true,
        loanNo: true,
        monthlyInstallment: true,
        schedules: {
          orderBy: { installmentNo: "asc" },
          take: 1,
          select: {
            principalAmount: true,
            interestAmount: true,
          },
        },
      },
    });

    let updated = 0;
    let skipped = 0;

    for (const loan of loans) {
      if (loan.schedules.length === 0) {
        skipped++;
        continue;
      }
      const schedTotal =
        Number(loan.schedules[0].principalAmount) +
        Number(loan.schedules[0].interestAmount);

      if (schedTotal <= 0) {
        skipped++;
        continue;
      }

      if (Math.abs(schedTotal - Number(loan.monthlyInstallment)) > 1000) {
        await prisma.loan.update({
          where: { id: loan.id },
          data: { monthlyInstallment: schedTotal },
        });
        updated++;
      } else {
        skipped++;
      }
    }

    return NextResponse.json({
      message: `${updated} pinjaman diupdate, ${skipped} dilewati (sudah sesuai)`,
      updated,
      skipped,
      total: loans.length,
    });
  } catch (error: any) {
    console.error("POST /api/loans/sync-installment error:", error);
    return NextResponse.json(
      { message: "Gagal sync: " + (error?.message || "Unknown error") },
      { status: 500 }
    );
  }
}
