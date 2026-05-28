import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkOperatorAuth, validateAndGetPeriod } from "./_lib/report-helpers";
import { queryMonthlyDanaResiko } from "./_lib/report-helpers";

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

  try {
    const { data, summary } = await queryMonthlyDanaResiko(periodResult.from, periodResult.to);
    return NextResponse.json({ data, summary });
  } catch (error) {
    console.error("[loans/reports/dana-resiko]", error);
    return NextResponse.json(
      { message: "Gagal memuat data laporan." },
      { status: 500 },
    );
  }
}
