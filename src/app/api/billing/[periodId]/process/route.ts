import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findUnitAccount } from "@/lib/cash-bank";

// POST /api/billing/[periodId]/process — Settle billing period
// Body: { memberIds?: number[] } — if provided, only settle these members. If omitted, settle all.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;
    const userId = Number(session.user.id);
    const body = await request.json().catch(() => ({}));
    const selectedMemberIds: number[] | null = body.memberIds?.length ? body.memberIds : null;

    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
      include: { billingItems: true },
    });

    if (!period) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    if (period.status !== "draft") {
      return NextResponse.json({ message: "Period sudah diproses" }, { status: 400 });
    }

    // Filter items by selected members (or all if none specified)
    const itemsToSettle = selectedMemberIds
      ? period.billingItems.filter((item) => selectedMemberIds.includes(item.memberId))
      : period.billingItems;

    const settledAmount = itemsToSettle.reduce((sum, i) => sum + Number(i.amount), 0);
    const settledMembers = new Set(itemsToSettle.map((i) => i.memberId)).size;
    const totalItems = period.billingItems.length;
    const isFullSettle = !selectedMemberIds || itemsToSettle.length === totalItems;

    // Process in transaction: mark paid on source transactions + update items + update period
    await prisma.$transaction(async (tx) => {
      // 1. Update all selected billing items: mark as paid
      await tx.billingItem.updateMany({
        where: {
          billingPeriodId: period.id,
          ...(selectedMemberIds ? { memberId: { in: selectedMemberIds } } : {}),
        },
        data: { isMarkedPaid: true, paidAt: new Date(), paidById: userId },
      });

      // 2. Update source transactions for ALL items being settled
      for (const item of itemsToSettle) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
        }
      }

      // 3. Record CashBankTransactions for settled salary_cut items, grouped by unit
      const itemsByUnit = new Map<string, { amount: number; count: number }>();
      for (const item of itemsToSettle) {
        const ut = item.unitType || "toko";
        const existing = itemsByUnit.get(ut);
        if (existing) {
          existing.amount += Number(item.amount);
          existing.count += 1;
        } else {
          itemsByUnit.set(ut, { amount: Number(item.amount), count: 1 });
        }
      }

      for (const [ut, data] of itemsByUnit) {
        // Salary deductions arrive via bank transfer from payroll
        let account = await findUnitAccount(tx, ut, "bank");
        // Fallback to cash if unit has no bank account
        if (!account) {
          account = await findUnitAccount(tx, ut, "cash");
        }
        if (!account) {
          console.warn(`[Billing] No bank/cash account for unit "${ut}" — skipping CashBankTransaction for Rp ${data.amount}`);
          continue;
        }

        const updatedAccount = await tx.cashBankAccount.update({
          where: { id: account.id },
          data: { currentBalance: { increment: data.amount } },
        });
        const balanceBefore = Number(updatedAccount.currentBalance) - data.amount;

        await tx.cashBankTransaction.create({
          data: {
            transactionNo: `SETTLE-${ut.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`,
            accountId: account.id,
            branchId: account.branchId,
            type: "in",
            category: "salary_cut_settlement",
            amount: data.amount,
            balanceBefore,
            balanceAfter: Number(updatedAccount.currentBalance),
            unitType: ut,
            description: `[${ut.toUpperCase()}] Penyelesaian Piutang Gaji — ${period.periodLabel} — ${data.count} transaksi`,
            transactionDate: new Date(),
            createdById: userId,
          },
        });
      }

      // 4. Update period status
      const uniqueMemberCount = new Set(period.billingItems.map((i) => i.memberId)).size;

      if (isFullSettle) {
        await tx.billingPeriod.update({
          where: { id: period.id },
          data: {
            status: "processed",
            processedById: userId,
            processedAt: new Date(),
            totalMembers: uniqueMemberCount,
            totalAmount: settledAmount,
          },
        });
      } else {
        // Partial settle: calculate cumulative totals from ALL paid items
        const allPaidItems = await tx.billingItem.findMany({
          where: { billingPeriodId: period.id, isMarkedPaid: true },
        });
        const cumulativeAmount = allPaidItems.reduce((sum, i) => sum + Number(i.amount), 0);
        const cumulativeMembers = new Set(allPaidItems.map((i) => i.memberId)).size;

        await tx.billingPeriod.update({
          where: { id: period.id },
          data: {
            totalMembers: cumulativeMembers,
            totalAmount: cumulativeAmount,
          },
        });
      }
    });

    return NextResponse.json({
      message: isFullSettle
        ? `Period berhasil diproses. ${settledMembers} anggota (${itemsToSettle.length} item) dilunaskan.`
        : `${settledMembers} anggota (${itemsToSettle.length} item) dilunaskan. Period masih draft untuk sisa anggota.`,
      settledMembers,
      settledItems: itemsToSettle.length,
      settledAmount,
      isFullSettle,
    });
  } catch (error) {
    console.error("POST /api/billing/[periodId]/process error:", error);
    return NextResponse.json({ message: "Failed to process period" }, { status: 500 });
  }
}
