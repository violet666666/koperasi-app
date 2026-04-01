import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/approvals
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");

        const statusParam = searchParams.get("status");

        let statusFilter = {};
        if (statusParam === "pending") {
            statusFilter = { status: "submitted" };
        } else if (statusParam === "history") {
            statusFilter = { status: { in: ["approved", "rejected", "disbursed", "cancelled"] } };
        }

        // Get loan applications
        // If there's a huge volume, we'd need pagination, but for now fetch recent.
        const loanApplications = await prisma.loanApplication.findMany({
            where: {
                ...(branchId && { branchId: parseInt(branchId) }),
                ...statusFilter
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true } },
                branch: { select: { id: true, name: true } },
                product: { select: { id: true, code: true, name: true } },
            },
            orderBy: { submittedAt: "desc" },
            take: 100, // Limit to recent 100 so it doesn't overload
        });

        const approvals = loanApplications.map((app) => ({
            id: app.id,
            requestType: "loan_application",
            referenceId: app.id,
            referenceNo: app.applicationNo,
            description: `Pengajuan Pinjaman ${app.product.name} oleh ${app.member.name}`,
            amount: Number(app.amount),
            branchId: app.branchId || 1,
            // the frontend expects 'pending', 'approved', or 'rejected'
            status: app.status === "submitted" ? "pending" : app.status,
            requestedBy: app.member,
            requestedAt: app.submittedAt,
            processedAt: app.approvedAt || app.rejectedAt || undefined,
            notes: app.rejectionReason || undefined
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
