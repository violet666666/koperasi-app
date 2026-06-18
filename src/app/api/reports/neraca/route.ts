import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildBalanceSheet } from "@/lib/services/neraca";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

// GET /api/reports/neraca - Balance Sheet berbasis ledger (snapshot per hari ini)
export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const balanceSheet = await buildBalanceSheet();
    return NextResponse.json({ data: balanceSheet });
  } catch (error) {
    console.error("GET /api/reports/neraca error:", error);
    return NextResponse.json(
      { message: "Failed to generate balance sheet" },
      { status: 500 },
    );
  }
}
