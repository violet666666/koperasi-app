import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/approvals
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status") || "pending";
        const branchId = searchParams.get("branchId");

        // Get pending loan applications
        const loanApplications = await prisma.loanApplication.findMany({
            where: {
                status: status === "pending" ? "submitted" : { in: ["approved", "rejected"] },
                ...(branchId && { branchId: parseInt(branchId) }),
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true } },
                branch: { select: { id: true, name: true } },
                product: { select: { id: true, code: true, name: true } },
            },
            orderBy: { submittedAt: "desc" },
        });

        const approvals = loanApplications.map((app) => ({
            id: app.id,
            type: "loan_application" as const,
            referenceNo: app.applicationNo,
            title: `Pengajuan Pinjaman ${app.product.name}`,
            description: `${app.member.name} - Rp ${Number(app.amount).toLocaleString("id-ID")}`,
            amount: Number(app.amount),
            status: app.status,
            submittedAt: app.submittedAt,
            approvedAt: app.approvedAt,
            rejectedAt: app.rejectedAt,
            member: app.member,
            branch: app.branch,
        }));

        return NextResponse.json({ data: approvals });
    } catch (error) {
        console.error("GET /api/approvals error:", error);
        return NextResponse.json(
            { message: "Failed to fetch approvals" },
            { status: 500 }
        );
    }
}
