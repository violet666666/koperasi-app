import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/approvals
 * Mengembalikan semua permintaan pending: loan applications + void requests
 */
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        // ── 1. Pengajuan Pinjaman ────────────────────────────────────────
        const loanApplications = await prisma.loanApplication.findMany({
            where: { status: "submitted" },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: { select: { name: true, interestRate: true } },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        // ── 2. Void Requests (ApprovalRequest dengan status pending) ─────
        const voidRequests = await prisma.approvalRequest.findMany({
            where: {
                status: "pending",
                type: { in: ["unit_void", "void_store_sale"] },
            },
            include: {
                requestedBy: { select: { name: true, unitType: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        // ── Gabung & normalisasi ──────────────────────────────────────────
        const loanItems = loanApplications.map((a) => ({
            id: a.id,
            requestType: "loan_application" as const,
            requestNo: a.applicationNo,
            status: a.status,
            amount: Number(a.amount),
            submittedAt: (a.submittedAt || a.createdAt).toISOString(),
            submittedBy: a.createdBy?.name || "-",
            // Loan-specific
            memberName: a.member.name,
            memberNo: a.member.memberNo,
            nrp: a.member.nrp,
            productName: a.product.name,
            tenor: a.tenorMonths,
            interestRate: Number(a.product.interestRate),
            purpose: a.purpose,
        }));

        const voidItems = voidRequests.map((v) => {
            // Parse metadata untuk ambil transactionNo & voidReason
            const meta = (v.metadata as any) || {};
            return {
                id: v.id,
                requestType: v.type as "unit_void" | "void_store_sale",
                requestNo: v.requestNo,
                status: v.status,
                amount: Number(v.amount ?? 0),
                submittedAt: v.requestedAt.toISOString(),
                submittedBy: v.requestedBy?.name || "-",
                // Void-specific
                transactionNo: meta.transactionNo || v.requestNo?.replace("VOID-", "") || "-",
                unitType: v.requestedBy?.unitType || meta.unitType || "-",
                voidReason: meta.reason || v.description || "-",
                description: v.description,
            };
        });

        // Sort gabungan by submittedAt desc
        const allItems = [...loanItems, ...voidItems].sort(
            (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
        );

        return NextResponse.json({ data: allItems });
    } catch (error) {
        console.error("GET /api/mobile/approvals error:", error);
        return NextResponse.json({ message: "Gagal memuat data approval" }, { status: 500 });
    }
}

/**
 * PATCH /api/mobile/approvals — Approve or Reject LOAN applications
 */
export async function PATCH(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { id, action, notes } = body;

        if (!id || !action || !["approve", "reject"].includes(action)) {
            return NextResponse.json({ message: "Parameter id dan action (approve/reject) wajib diisi" }, { status: 400 });
        }

        const application = await prisma.loanApplication.findUnique({ where: { id: Number(id) } });
        if (!application || application.status !== "submitted") {
            return NextResponse.json({ message: "Pengajuan tidak ditemukan atau sudah diproses" }, { status: 404 });
        }

        const updateData: any = { status: action === "approve" ? "approved" : "rejected" };
        if (action === "approve") {
            updateData.approvedById = Number(user.id);
            updateData.approvedAt = new Date();
        } else {
            updateData.rejectedById = Number(user.id);
            updateData.rejectedAt = new Date();
            updateData.rejectionReason = notes || null;
        }

        await prisma.loanApplication.update({
            where: { id: Number(id) },
            data: updateData,
        });

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: action === "approve" ? "APPROVE" : "REJECT",
            module: "Pinjaman",
            description: `${action === "approve" ? "Menyetujui" : "Menolak"} pengajuan pinjaman #${id} via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({ message: `Pengajuan berhasil di-${action === "approve" ? "setujui" : "tolak"}` });
    } catch (error) {
        console.error("PATCH /api/mobile/approvals error:", error);
        return NextResponse.json({ message: "Gagal memproses approval" }, { status: 500 });
    }
}
