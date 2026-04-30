import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const roleName = (session.user as any)?.role?.name;
  if (roleName !== "operator") {
    return NextResponse.json({ message: "Akses ditolak. Hanya operator." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const monthFrom = searchParams.get("monthFrom");
  const monthTo = searchParams.get("monthTo");

  const now = new Date();
  const WIB_OFFSET = 7 * 60 * 60 * 1000;
  const nowWIB = new Date(now.getTime() + WIB_OFFSET);
  const currentYM = `${nowWIB.getUTCFullYear()}-${String(nowWIB.getUTCMonth() + 1).padStart(2, "0")}`;

  const from = monthFrom || currentYM;
  const to = monthTo || currentYM;

  const [fromYear, fromMonth] = from.split("-").map(Number);
  const [toYear, toMonth] = to.split("-").map(Number);

  const dateFrom = new Date(Date.UTC(fromYear, fromMonth - 1, 1) - WIB_OFFSET);
  const dateTo = new Date(Date.UTC(toYear, toMonth, 0, 23 - 7, 59, 59, 999));

  const payments = await prisma.loanPayment.findMany({
    where: {
      paymentDate: { gte: dateFrom, lte: dateTo },
    },
    select: {
      paymentDate: true,
      interestPortion: true,
      principalPortion: true,
    },
    orderBy: { paymentDate: "asc" },
  });

  const monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

  const monthMap = new Map<string, { totalJasa: number; totalPokok: number; totalTransactions: number }>();

  for (const p of payments) {
    const d = new Date(p.paymentDate.getTime() + WIB_OFFSET);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    if (!monthMap.has(key)) {
      monthMap.set(key, { totalJasa: 0, totalPokok: 0, totalTransactions: 0 });
    }
    const entry = monthMap.get(key)!;
    entry.totalJasa += Number(p.interestPortion);
    entry.totalPokok += Number(p.principalPortion);
    entry.totalTransactions += 1;
  }

  const rows = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, totals], idx) => {
      const [y, m] = month.split("-").map(Number);
      return [idx + 1, `${monthNames[m - 1]} ${y}`, totals.totalJasa, totals.totalPokok, totals.totalTransactions];
    });

  const grandJasa = rows.reduce((s, r) => s + (r[2] as number), 0);
  const grandPokok = rows.reduce((s, r) => s + (r[3] as number), 0);
  const grandTrx = rows.reduce((s, r) => s + (r[4] as number), 0);

  rows.push(["", "GRAND TOTAL", grandJasa, grandPokok, grandTrx]);

  const wsData = [
    ["No", "Bulan", "Total Jasa (Rp)", "Total Pokok (Rp)", "Jumlah Transaksi"],
    ...rows,
  ];

  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 20 }, { wch: 20 }, { wch: 18 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rekap Jasa");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  const fileName = `Rekap_Jasa_Pinjaman_${from}_sd_${to}.xlsx`;

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
    },
  });
}
