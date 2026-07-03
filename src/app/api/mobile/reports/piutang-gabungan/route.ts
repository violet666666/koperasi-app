import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope } from "../../middleware";
import { aggregatePiutangGabungan, buildPiutangCSV } from "@/lib/services/piutang-gabungan";

export async function GET(request: Request) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user || !["operator", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Hanya Operator/Admin SP yang dapat mengakses laporan ini" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const isExport = searchParams.get("export") === "true";
    const format = searchParams.get("format");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));
    const search = (searchParams.get("search") || "").trim().toLowerCase();

    const members = await prisma.member.findMany({
      where: { status: "active", deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, pangkat: true, category: true, kesatuan: true },
      orderBy: { name: "asc" },
    });

    if (members.length === 0) {
      return NextResponse.json({ data: { piutangList: [], totalAnggota: 0, totalPiutangToko: 0, totalPiutangUnit: 0, totalPiutangSPPokok: 0, totalPiutangSPJasa: 0, grandTotal: 0 } });
    }

    const memberIds = members.map((m) => m.id);

    const unitTxAgg = await prisma.unitTransaction.groupBy({
      by: ["memberId", "unitType"],
      where: { memberId: { in: memberIds }, paymentMethod: "salary_cut", isPaid: false, status: "completed" },
      _sum: { amount: true },
    });

    const activeLoans = await prisma.loan.findMany({
      where: { memberId: { in: memberIds }, status: "active" },
      select: {
        memberId: true, loanNo: true, principalOutstanding: true, interestOutstanding: true,
        tenorMonths: true, disbursementDate: true,
        schedules: { where: { status: { in: ["pending", "partial", "overdue"] } }, select: { installmentNo: true }, orderBy: { installmentNo: "asc" }, take: 1 },
      },
    });

    const agg = aggregatePiutangGabungan({ members, unitTxAgg, activeLoans });

    // Totals are ALWAYS full-set. Search + pagination affect only the returned rows.
    const filtered = search
      ? agg.piutangList.filter((p) =>
          p.nama.toLowerCase().includes(search) ||
          p.nrp.toLowerCase().includes(search) ||
          p.pangkat.toLowerCase().includes(search) ||
          p.kesatuan.toLowerCase().includes(search))
      : agg.piutangList;

    if (format === "csv") {
      const csv = buildPiutangCSV(filtered, agg);
      return new NextResponse(csv, { headers: { "Content-Type": "text/csv; charset=utf-8" } });
    }

    if (isExport) {
      return NextResponse.json({ data: { piutangList: filtered, ...restTotals(agg) } });
    }

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
    const paginated = filtered.slice((page - 1) * perPage, page * perPage);
    return NextResponse.json({ data: { piutangList: paginated, ...restTotals(agg), pagination: { page, perPage, totalItems, totalPages } } });
  } catch (err) {
    console.error("GET /api/mobile/reports/piutang-gabungan error:", err);
    return NextResponse.json({ message: "Gagal generate laporan piutang gabungan" }, { status: 500 });
  }
}

function restTotals(agg: ReturnType<typeof aggregatePiutangGabungan>) {
  return {
    totalAnggota: agg.totalAnggota,
    totalPiutangToko: agg.totalPiutangToko,
    totalPiutangUnit: agg.totalPiutangUnit,
    totalPiutangSPPokok: agg.totalPiutangSPPokok,
    totalPiutangSPJasa: agg.totalPiutangSPJasa,
    grandTotal: agg.grandTotal,
  };
}
