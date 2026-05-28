import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import * as XLSX from "xlsx";
import {
  checkOperatorAuth,
  validateAndGetPeriod,
  queryMonthlyDanaResiko,
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
    const { data } = await queryMonthlyDanaResiko(from, to);

    const rows = data.map((row, idx) => [
      idx + 1,
      row.monthLabel,
      row.loanCount,
      row.totalPokok,
      row.totalDanaResiko,
    ]);

    const grandLoans = rows.reduce((s, r) => s + (r[2] as number), 0);
    const grandPokok = rows.reduce((s, r) => s + (r[3] as number), 0);
    const grandResiko = rows.reduce((s, r) => s + (r[4] as number), 0);
    rows.push(["", "GRAND TOTAL", grandLoans, grandPokok, grandResiko]);

    const wsData = [
      ["No", "Bulan", "Jumlah Pinjaman", "Total Pokok (Rp)", "Dana Resiko 2% (Rp)"],
      ...rows,
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws["!cols"] = [{ wch: 5 }, { wch: 20 }, { wch: 18 }, { wch: 22 }, { wch: 22 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap Dana Resiko");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    const fileName = `Rekap_Dana_Resiko_${from}_sd_${to}.xlsx`;

    return new NextResponse(buf, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (error) {
    console.error("[loans/reports/dana-resiko/export]", error);
    return NextResponse.json(
      { message: "Gagal membuat file export." },
      { status: 500 },
    );
  }
}
