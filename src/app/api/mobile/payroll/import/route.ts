import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../middleware";
import {
    parsePayrollExcel,
    commitPayrollPeriod,
    PayrollImportError,
    MAX_FILE_SIZE,
    ALLOWED_EXTENSIONS,
    ALLOWED_SOURCES,
} from "@/lib/services/payroll-import";

/**
 * POST /api/mobile/payroll/import
 * Mobile parity of web POST /api/payroll/import (Fase 8c T3).
 * Shares parsePayrollExcel + commitPayrollPeriod with the web route — single source
 * of truth for the biggest monthly money op. Operator-only (no branch scope:
 * PayrollPeriod is org-wide).
 *
 * Body (multipart/form-data): file (.xlsx/.xls/.csv), mode ("preview"|"commit"),
 * sourceType ("polres"|"polsek"). Response shapes byte-identical to the web route.
 */
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();

    // Operator-only — parity with web (admin/admin_sp/kasir excluded).
    if (user.role !== "operator") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";
        const sourceType = ((formData.get("sourceType") as string) || "polres").toLowerCase();

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ message: "File terlalu besar (maks 10MB)" }, { status: 400 });
        }

        const ext = file.name.substring(file.name.lastIndexOf(".")).toLowerCase();
        if (!ALLOWED_EXTENSIONS.includes(ext)) {
            return NextResponse.json({ message: "Format file harus .xlsx, .xls, atau .csv" }, { status: 400 });
        }

        if (!ALLOWED_SOURCES.includes(sourceType)) {
            return NextResponse.json({ message: "sourceType harus 'polres' atau 'polsek'" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const parsed = await parsePayrollExcel(buffer, sourceType, file.name);

        // Preview mode
        if (mode === "preview") {
            return NextResponse.json({
                data: {
                    mode: "preview",
                    sheetName: parsed.sheetName,
                    periodName: parsed.periodInfo.periodName,
                    periodMonth: parsed.periodInfo.periodMonth,
                    periodYear: parsed.periodInfo.periodYear,
                    sourceFile: file.name,
                    sourceType,
                    totalRows: parsed.counts.totalRows,
                    success: parsed.counts.success,
                    failed: parsed.counts.failed,
                    preview: parsed.rows.slice(0, 50).map((s, idx) => ({
                        row: idx + 1,
                        nrp: s.nrp,
                        nama: s.nama,
                        pangkat: s.pangkat,
                        gajiBersih: s.gajiBersih,
                        potTajib: s.potTajib,
                        potSP: s.potSP,
                        potBarang: s.potBarang,
                        totalPotKoperasi: s.totalPotKoperasi,
                        sisaGaji: s.sisaGaji,
                        terimaBersih: s.terimaBersih,
                        memberId: s.memberId,
                        status: s.memberId ? "valid" : "no_match",
                    })),
                    columnCount: parsed.columnCount,
                    headers: parsed.headers,
                },
            });
        }

        // Commit mode
        const result = await commitPayrollPeriod(parsed.rows, parsed.periodInfo, sourceType, file.name, Number(user.id));

        // Audit (mobile pattern: direct prisma.auditLog.create from JWT user — no NextAuth session).
        // Non-blocking — audit failure must not roll back the committed import.
        await prisma.auditLog.create({
            data: {
                action: "IMPORT",
                module: "Payroll",
                description: `Import gaji ${result.periodName}: ${result.counts.totalRows} anggota`,
                userId: Number(user.id),
                userName: user.name,
                userRole: user.role,
                status: "success",
                newData: JSON.stringify({ periodId: result.periodId, totalMembers: result.counts.totalRows }),
            },
        }).catch(() => { /* audit failure non-blocking */ });

        return NextResponse.json({
            data: {
                mode: "commit",
                periodId: result.periodId,
                periodName: result.periodName,
                totalRows: result.counts.totalRows,
                success: result.counts.success,
                failed: parsed.counts.failed,
            },
        });
    } catch (error: unknown) {
        // Map typed helper errors (400 no-sheet/bad-header, 409 duplicate) to their HTTP status,
        // preserving the web route's response shape (incl. existingPeriodId on 409).
        if (error instanceof PayrollImportError) {
            const body: { message: string; existingPeriodId?: number } = { message: error.statusMessage };
            if (error.existingPeriodId !== undefined) {
                body.existingPeriodId = error.existingPeriodId;
            }
            return NextResponse.json(body, { status: error.statusCode });
        }
        console.error("POST /api/mobile/payroll/import error:", error);
        const message = error instanceof Error ? error.message : "Unknown error";
        return NextResponse.json({ message: "Gagal memproses file gaji: " + message }, { status: 500 });
    }
}
