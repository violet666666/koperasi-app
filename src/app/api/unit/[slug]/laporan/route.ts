import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";
import {
  getUnitLaporanData,
  UnitLaporanValidationError,
} from "@/lib/services/unit-laporan";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * GET /api/unit/[slug]/laporan
 * Query params: dateFrom, dateTo, period (today|week|month|year|custom),
 *               page (default 1), perPage (default 50), export (boolean)
 *
 * Returns aggregated transaction report for the given unit slug.
 * - Unit Jasa (cuci_mobil, barbershop, dll): queries UnitTransaction
 * - Unit Toko: queries StoreSale + UnitTransaction (piutang)
 * - Pagination only applies to the transactions list; summary/expenses/incomes are always complete.
 * - export=true returns ALL transactions without pagination (for Excel/Print).
 */
export async function GET(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const slug = params.slug;
        const unitType = slug.replace(/-/g, "_");

        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");

        // Access control: kasir/admin can only access their own unit (alias-aware)
        if (!isOperator && userUnitType && !isSameUnit(userUnitType, unitType)) {
            return NextResponse.json({ message: "Akses ditolak. Anda tidak terdaftar di unit ini." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period") || "month";
        const dateFromParam = searchParams.get("dateFrom");
        const dateToParam = searchParams.get("dateTo");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
        const perPage = Math.min(200, Math.max(1, parseInt(searchParams.get("perPage") || "50", 10)) || 50);
        const isExport = searchParams.get("export") === "true";
        const sortBy = searchParams.get("sortBy") || "transactionDate";
        const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc";

        // All data logic (date-range compute, 3-model queries, aggregation,
        // pagination, response build) lives in the shared helper — web + mobile
        // call the same code (Fase 7b T2). The custom-period 400 validation is
        // enforced inside the helper (UnitLaporanValidationError).
        try {
            const data = await getUnitLaporanData({
                unitType,
                slug,
                period,
                dateFrom: dateFromParam ?? undefined,
                dateTo: dateToParam ?? undefined,
                page,
                perPage,
                isExport,
                sortBy,
                sortOrder,
            });
            return NextResponse.json({ data });
        } catch (e) {
            if (e instanceof UnitLaporanValidationError) {
                return NextResponse.json({ message: e.statusMessage }, { status: 400 });
            }
            throw e;
        }
    } catch (error) {
        console.error("GET /api/unit/[slug]/laporan error:", error);
        return NextResponse.json({ message: "Gagal mengambil data laporan" }, { status: 500 });
    }
}
