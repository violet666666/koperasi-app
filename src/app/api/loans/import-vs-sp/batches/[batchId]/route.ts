import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import {
  logAudit,
  extractRequestInfo,
  extractUserFromSession,
} from "@/lib/audit-logger";

// DELETE /api/loans/import-vs-sp/batches/[batchId]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const roleName =
      typeof session.user.role === "string"
        ? session.user.role
        : (session.user.role as { name?: string })?.name;
    if (roleName !== "operator") {
      return NextResponse.json(
        { message: "Hanya Operator yang dapat membatalkan import." },
        { status: 403 }
      );
    }

    const { batchId } = await params;
    const batch = await prisma.importBatch.findUnique({
      where: { id: parseInt(batchId) },
    });
    if (!batch) {
      return NextResponse.json(
        { message: "Batch tidak ditemukan" },
        { status: 404 }
      );
    }

    const loanIds = (batch.loanIds as number[]) || [];
    const paymentIds = (batch.paymentIds as number[]) || [];
    const memberIds = (batch.memberIds as number[]) || [];
    const snapshots =
      (batch.preImportSnapshots as Record<string, Record<string, unknown>>) ||
      {};

    let undonePayments = 0;
    let revertedLoans = 0;
    let deletedMembers = 0;

    await prisma.$transaction(async (tx) => {
      // 1. Delete LoanPayments created by this batch
      if (paymentIds.length > 0) {
        const result = await tx.loanPayment.deleteMany({
          where: { id: { in: paymentIds } },
        });
        undonePayments = result.count;
      }

      // 2. Revert updated Loans to pre-import state (only for UPDATE, not new loans)
      for (const [loanId, snapshot] of Object.entries(snapshots)) {
        try {
          await tx.loan.update({
            where: { id: parseInt(loanId) },
            data: {
              principalPaid: snapshot.principalPaid as number | null,
              principalOutstanding: snapshot.principalOutstanding as number | null,
              interestPaid: snapshot.interestPaid as number | null,
              interestOutstanding: snapshot.interestOutstanding as number | null,
              status: snapshot.status as string,
              paidOffDate:
                snapshot.status !== "paid_off"
                  ? null
                  : undefined,
            },
          });
          revertedLoans++;
        } catch (e) {
          console.error(`Failed to revert loan ${loanId}:`, e);
        }
      }

      // 3. Delete new members and their loans (cascade)
      for (const memberId of memberIds) {
        try {
          const memberLoans = await tx.loan.findMany({
            where: { memberId },
            select: { id: true },
          });
          for (const loan of memberLoans) {
            await tx.loanSchedule.deleteMany({ where: { loanId: loan.id } });
            await tx.loanPayment.deleteMany({ where: { loanId: loan.id } });
            await tx.loanApplication.deleteMany({
              where: { loan: { id: loan.id } },
            });
            await tx.loan.delete({ where: { id: loan.id } });
          }
          await tx.user.deleteMany({ where: { memberId } });
          await tx.member.delete({ where: { id: memberId } });
          deletedMembers++;
        } catch (e) {
          console.error(`Failed to delete member ${memberId}:`, e);
        }
      }

      // 4. Delete the batch record itself
      await tx.importBatch.delete({ where: { id: parseInt(batchId) } });
    });

    // Audit
    try {
      const reqInfo = extractRequestInfo(request);
      const userInfo = extractUserFromSession(session);
      await logAudit({
        ...userInfo,
        ...reqInfo,
        action: "DELETE",
        module: "Loan_VS_SP",
        description: `Undo batch ${batch.batchNo}: ${undonePayments} payments deleted, ${revertedLoans} loans reverted, ${deletedMembers} members deleted`,
      });
    } catch {
      // Audit logging failure should not block the response
    }

    return NextResponse.json({
      message: `Batch ${batch.batchNo} berhasil dibatalkan`,
      undonePayments,
      revertedLoans,
      deletedMembers,
    });
  } catch (error) {
    console.error("DELETE batch error:", error);
    return NextResponse.json(
      { message: "Gagal membatalkan batch" },
      { status: 500 }
    );
  }
}
