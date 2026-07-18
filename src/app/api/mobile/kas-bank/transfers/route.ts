import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { createTransferSchema } from "@/lib/validations";
import { generateTransferTxnNo } from "@/lib/services/cash-bank-txn-no";
import { logAudit } from "@/lib/audit-logger";

export async function POST(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin/Admin SP yang dapat transfer" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = createTransferSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    if (d.fromAccountId === d.toAccountId) {
      return NextResponse.json({ message: "Akun asal dan tujuan tidak boleh sama" }, { status: 400 });
    }

    const [fromAcct, toAcct] = await Promise.all([
      prisma.cashBankAccount.findFirst({ where: { id: d.fromAccountId, isActive: true, deletedAt: null } }),
      prisma.cashBankAccount.findFirst({ where: { id: d.toAccountId, isActive: true, deletedAt: null } }),
    ]);
    if (!fromAcct || !toAcct) return NextResponse.json({ message: "Akun asal/tujuan tidak ditemukan" }, { status: 404 });
    // canAccessBranch returns ScopeDecision ({allowed, reason?}), NOT a boolean — use .allowed.
    // Each side uses its own account.branchId, so cross-branch transfers are allowed only when
    // the user can access BOTH branches (operator bypass; non-operator fails unless both match).
    if (!canAccessBranch(user, fromAcct.branchId).allowed || !canAccessBranch(user, toAcct.branchId).allowed) {
      return NextResponse.json({ message: "Akses ditolak: akun di luar scope anda" }, { status: 403 });
    }

    const amount = Number(d.amount);
    const txDate = d.transactionDate ? new Date(d.transactionDate) : new Date();
    const year = txDate.getFullYear();
    const base = generateTransferTxnNo(year);

    const result = await prisma.$transaction(async (tx) => {
      const from = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: fromAcct.id } });
      const to = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: toAcct.id } });
      const fromBefore = Number(from.currentBalance);
      if (amount > fromBefore) throw new Error("SALDO_KURANG");
      const fromAfter = fromBefore - amount;
      const toAfter = Number(to.currentBalance) + amount;

      const out = await tx.cashBankTransaction.create({
        data: {
          transactionNo: `${base}-OUT`, accountId: from.id, branchId: from.branchId,
          type: "out", category: "transfer", amount, balanceBefore: fromBefore, balanceAfter: fromAfter,
          description: d.description ?? `Transfer ke ${to.name}`, transactionDate: txDate, createdById: Number(user.id),
        },
      });
      const inn = await tx.cashBankTransaction.create({
        data: {
          transactionNo: `${base}-IN`, accountId: to.id, branchId: to.branchId,
          type: "in", category: "transfer", amount, balanceBefore: Number(to.currentBalance), balanceAfter: toAfter,
          description: d.description ?? `Transfer dari ${from.name}`, transactionDate: txDate, createdById: Number(user.id),
        },
      });
      await tx.cashBankAccount.update({ where: { id: from.id }, data: { currentBalance: fromAfter } });
      await tx.cashBankAccount.update({ where: { id: to.id }, data: { currentBalance: toAfter } });
      return { out, in: inn };
    });

    await logAudit({
      userId: Number(user.id),
      userName: user.name,
      userRole: user.role,
      action: "CREATE",
      module: "Kas",
      description: `[MOBILE] Transfer ${amount} dari akun ${fromAcct.name} ke ${toAcct.name} (${result.out.transactionNo})`,
      targetId: result.out.id,
      targetType: "CashBankTransaction",
      newData: { fromAccountId: d.fromAccountId, toAccountId: d.toAccountId, amount },
      ipAddress: "mobile-app",
    });

    return NextResponse.json({ data: { outTransaction: result.out, inTransaction: result.in } }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "SALDO_KURANG") return NextResponse.json({ message: "Saldo asal tidak mencukupi" }, { status: 400 });
    console.error("POST /api/mobile/kas-bank/transfers error:", err);
    return NextResponse.json({ message: "Gagal memproses transfer" }, { status: 500 });
  }
}
