import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../../middleware";
import { aggregatePiutangGabungan, TOKO_UNIT_TYPES } from "@/lib/services/piutang-gabungan";

export async function GET(request: Request, { params }: { params: Promise<{ memberId: string }> }) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin SP yang dapat mengakses laporan ini" }, { status: 403 });
    }

    const { memberId } = await params;
    const id = Number(memberId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "memberId tidak valid" }, { status: 400 });
    }

    const member = await prisma.member.findFirst({
      where: { id, status: "active", deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, pangkat: true, category: true, kesatuan: true },
    });
    if (!member) return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });

    const [unitTxAgg, loansRaw, txRaw] = await Promise.all([
      prisma.unitTransaction.groupBy({
        by: ["memberId", "unitType"],
        where: { memberId: id, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
        _sum: { amount: true },
      }),
      prisma.loan.findMany({
        where: { memberId: id, status: "active" },
        select: {
          loanNo: true, principalOutstanding: true, interestOutstanding: true, tenorMonths: true, disbursementDate: true,
          schedules: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { installmentNo: true }, orderBy: { installmentNo: "asc" }, take: 1 },
        },
      }),
      prisma.unitTransaction.findMany({
        where: { memberId: id, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
        select: { transactionNo: true, transactionDate: true, unitType: true, description: true, amount: true },
        orderBy: { transactionDate: "desc" },
      }),
    ]);

    // Reuse the helper to compute this member's exact row (guarantees parity with the list row).
    const row = aggregatePiutangGabungan({ members: [member], unitTxAgg, activeLoans: loansRaw as any });

    const loans = loansRaw.map((l) => {
      const next = (l as any).schedules[0]?.installmentNo;
      return {
        loanNo: l.loanNo,
        angsuranKe: next ? `${next}/${l.tenorMonths}` : "-",
        pokok: Number(l.principalOutstanding),
        jasa: Number(l.interestOutstanding),
        tenorMonths: l.tenorMonths,
        disbursementDate: l.disbursementDate,
      };
    });

    const transactions = txRaw.map((t) => ({
      transactionNo: t.transactionNo,
      date: t.transactionDate,
      unitType: t.unitType,
      description: t.description,
      amount: Number(t.amount),
      source: TOKO_UNIT_TYPES.includes(t.unitType || "") ? "toko" : "unit",
    }));

    const item = row.piutangList[0];
    return NextResponse.json({
      data: {
        member: { id: member.id, name: member.name, nrp: member.nrp || member.memberNo, pangkat: member.pangkat || member.category || "-", kesatuan: member.kesatuan || "-" },
        loans,
        transactions,
        totals: item
          ? { piutangToko: item.piutangToko, piutangUnit: item.piutangUnit, piutangSPPokok: item.piutangSPPokok, piutangSPJasa: item.piutangSPJasa, total: item.totalPiutang }
          : { piutangToko: 0, piutangUnit: 0, piutangSPPokok: 0, piutangSPJasa: 0, total: 0 },
      },
    });
  } catch (err) {
    console.error("GET /api/mobile/reports/piutang-gabungan/[memberId] error:", err);
    return NextResponse.json({ message: "Gagal memuat detail piutang" }, { status: 500 });
  }
}
