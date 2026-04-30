import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";
import {
  checkOperatorAuth,
  validateAndGetPeriod,
  queryMonthlyPayments,
} from "../_lib/report-helpers";

export async function GET(request: Request) {
  const session = await auth();
  const authError = checkOperatorAuth(session);
  if (authError) return authError;

  const { searchParams } = new URL(request.url);
  const periodResult = validateAndGetPeriod(
    searchParams.get("monthFrom"),
    searchParams.get("monthTo"),
  );
  if ("error" in periodResult) return periodResult.error;
  const { from, to } = periodResult;

  try {
    const { data } = await queryMonthlyPayments(from, to);

    const rows = data.map((row, idx) => [
      idx + 1,
      row.monthLabel,
      row.totalJasa,
      row.totalPokok,
      row.totalTransactions,
    ]);

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
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    console.error("[loans/reports/interest/export]", error);
    return NextResponse.json(
      { message: "Gagal membuat file export." },
      { status: 500 },
    );
  }
}
