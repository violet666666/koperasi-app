import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";

/**
 * POST /api/unit/[slug]/laporan/submit-review
 * Admin unit submit laporan periodik untuk review oleh Operator.
 * Membuat ApprovalRequest tipe `laporan_unit` di Inbox Approval.
 *
 * Body: { period: string, periodLabel: string, dateFrom: string, dateTo: string, summary: object }
 */
export async function POST(
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
        const isAdmin = roleName === "admin";

        // Hanya Admin Unit atau Operator yang bisa submit laporan
        if (!isAdmin && !isOperator) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat submit laporan" }, { status: 403 });
        }

        // Admin hanya bisa submit laporan unitnya sendiri
        if (isAdmin && !isOperator && !isSameUnit(userUnitType, unitType)) {
            return NextResponse.json({ message: "Anda hanya dapat submit laporan unit Anda sendiri" }, { status: 403 });
        }

        const body = await request.json();
        const { period, periodLabel, dateFrom, dateTo, summary } = body;

        if (!periodLabel || !summary) {
            return NextResponse.json({ message: "periodLabel dan summary wajib diisi" }, { status: 400 });
        }

        // Cari user ID dari session
        const dbUser = await prisma.user.findFirst({
            where: { email: session.user.email! },
            select: { id: true, name: true, branchId: true },
        });

        if (!dbUser) {
            return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
        }

        const unitLabel = unitType.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
        const refNo = `LAP-${unitType.toUpperCase()}-${Date.now()}`;

        // Buat ApprovalRequest untuk Inbox Operator
        const approvalRequest = await prisma.approvalRequest.create({
            data: {
                referenceNo: refNo,
                type: "laporan_unit",
                status: "pending",
                description: `📊 Laporan ${unitLabel}: ${periodLabel} — Pendapatan ${formatRupiah(summary.totalPendapatan || 0)}, ${summary.totalTransaksi || 0} transaksi`,
                requestedById: dbUser.id,
                branchId: dbUser.branchId,
                metadata: JSON.stringify({
                    unitType,
                    unitSlug: slug,
                    periodLabel,
                    period: period || "custom",
                    dateFrom,
                    dateTo,
                    summary,
                    submittedAt: new Date().toISOString(),
                    submittedByName: dbUser.name || session.user.email,
                }),
            },
        });

        return NextResponse.json({
            message: `Laporan ${unitLabel} periode ${periodLabel} berhasil dikirim ke Operator untuk review.`,
            data: { referenceNo: refNo, approvalId: approvalRequest.id },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit/[slug]/laporan/submit-review error:", error);
        return NextResponse.json({ message: "Gagal mengirim laporan untuk review" }, { status: 500 });
    }
}

function formatRupiah(n: number): string {
    return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(n);
}
