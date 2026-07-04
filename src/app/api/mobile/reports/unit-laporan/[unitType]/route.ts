import { NextResponse } from "next/server";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../middleware";
import { canAccessUnit } from "@/lib/mobile-auth-scope";
import {
  getUnitLaporanData,
  UnitLaporanValidationError,
} from "@/lib/services/unit-laporan";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/reports/unit-laporan/[unitType]
 * Mobile counterpart of the web `/api/unit/[slug]/laporan` route (Fase 7b T3).
 * Calls the shared `getUnitLaporanData` helper (T2) — same data logic as web.
 *
 * Auth: mobile JWT (via `getMobileUserWithScope`, which reloads fresh
 * branchId/unitType/memberId from DB). Gate: operator/admin/admin_sp only
 * (kasir excluded) + `canAccessUnit` scope check (operator bypass;
 * admin/admin_sp → own unit alias-family; fail-closed 403).
 *
 * Query params (mirror web): period (today|week|month|year|custom),
 *   dateFrom, dateTo (required for custom), page, perPage, export, sortBy,
 *   sortOrder. Response envelope: `{ data }`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ unitType: string }> },
) {
  try {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();

    if (!["operator", "admin", "admin_sp"].includes(user.role)) {
      return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    const { unitType } = await params;
    // .allowed — ScopeDecision object (Fase 7a lesson). Fail-closed 403.
    if (!canAccessUnit(user, unitType).allowed) {
      return NextResponse.json(
        { message: "Akses ditolak: unit di luar scope anda." },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    try {
      const data = await getUnitLaporanData({
        unitType,
        // Mobile route has no kebab slug context; pass unitType verbatim as
        // unitSlug (the helper only echoes it back into the response shape).
        slug: unitType,
        period: searchParams.get("period") || "month",
        dateFrom: searchParams.get("dateFrom") || undefined,
        dateTo: searchParams.get("dateTo") || undefined,
        page: Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1),
        perPage: Math.min(
          200,
          Math.max(1, parseInt(searchParams.get("perPage") || "50", 10)) || 50,
        ),
        isExport: searchParams.get("export") === "true",
        sortBy: searchParams.get("sortBy") || "transactionDate",
        sortOrder: searchParams.get("sortOrder") === "asc" ? "asc" : "desc",
      });
      return NextResponse.json({ data });
    } catch (err) {
      // CONTRACT (T2): custom period missing dateFrom/dateTo → 400.
      if (err instanceof UnitLaporanValidationError) {
        return NextResponse.json({ message: err.statusMessage }, { status: 400 });
      }
      throw err;
    }
  } catch (err) {
    console.error("GET /api/mobile/reports/unit-laporan error:", err);
    return NextResponse.json(
      { message: "Gagal memuat laporan unit" },
      { status: 500 },
    );
  }
}
