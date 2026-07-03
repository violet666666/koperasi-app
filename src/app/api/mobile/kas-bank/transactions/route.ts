import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { createCashBankTransactionSchema } from "@/lib/validations";
import { detectCategoryMismatch } from "@/lib/services/cash-bank-category-guard";
import { generateCashBankTxnNo } from "@/lib/services/cash-bank-txn-no";

export async function POST(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin/Admin SP yang dapat mencatat transaksi kas/bank" }, { status: 403 });
    }
    const body = await request.json();
    const parsed = createCashBankTransactionSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ message: "Data tidak valid", errors: parsed.error.flatten() }, { status: 400 });
    }
    const d = parsed.data;
    // Mobile = simple tx. Explicitly ignore unitType/memberId if a client ever sends them (no Cuci Mobil split).

    const account = await prisma.cashBankAccount.findFirst({
      where: { id: d.accountId, isActive: true, deletedAt: null },
    });
    if (!account) return NextResponse.json({ message: "Akun kas/bank tidak ditemukan" }, { status: 404 });
    if (!canAccessBranch(user, account.branchId)) {
      return NextResponse.json({ message: "Akses ditolak: akun di luar scope anda" }, { status: 403 });
    }

    // SHU-integrity guard (reused). Fires only for type=out + at-risk expense category + keyword.
    const mismatch = detectCategoryMismatch(d.type, d.category, d.description);
    if (mismatch && !d.confirmMiscat) {
      return NextResponse.json(
        { requiresConfirm: true, message: mismatch.message, suggestedCategory: mismatch.suggestedCategory },
        { status: 400 },
      );
    }

    const amount = Number(d.amount);
    const txDate = d.transactionDate ? new Date(d.transactionDate) : new Date();

    const result = await prisma.$transaction(async (tx) => {
      // Re-read inside tx for an accurate balance snapshot (avoid read-then-write race).
      const fresh = await tx.cashBankAccount.findUniqueOrThrow({ where: { id: account.id } });
      const balanceBefore = Number(fresh.currentBalance);
      if (d.type === "out" && amount > balanceBefore) throw new Error("SALDO_KURANG");
      const balanceAfter = d.type === "in" ? balanceBefore + amount : balanceBefore - amount;
      const created = await tx.cashBankTransaction.create({
        data: {
          transactionNo: generateCashBankTxnNo(d.type, txDate.getFullYear()),
          accountId: fresh.id,
          branchId: fresh.branchId,
          type: d.type,
          category: d.category ?? null,
          amount,
          balanceBefore,
          balanceAfter,
          description: d.description ?? null,
          transactionDate: txDate,
          createdById: Number(user.id),
        },
      });
      await tx.cashBankAccount.update({ where: { id: fresh.id }, data: { currentBalance: balanceAfter } });
      return { created, balanceAfter };
    });

    return NextResponse.json({ data: { transaction: result.created, currentBalance: result.balanceAfter } }, { status: 201 });
  } catch (err: any) {
    if (err?.message === "SALDO_KURANG") return NextResponse.json({ message: "Saldo tidak mencukupi" }, { status: 400 });
    console.error("POST /api/mobile/kas-bank/transactions error:", err);
    return NextResponse.json({ message: "Gagal menyimpan transaksi" }, { status: 500 });
  }
}
