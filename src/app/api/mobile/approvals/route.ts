import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// GET /api/mobile/approvals — List pending loan applications
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const applications = await prisma.loanApplication.findMany({
            where: { status: "submitted" },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: { select: { name: true, interestRate: true } },
            },
            orderBy: { createdAt: "desc" },
            take: 50,
        });

        return NextResponse.json({
            data: applications.map((a) => ({
                id: a.id,
                memberName: a.member.name,
                memberNo: a.member.memberNo,
                nrp: a.member.nrp,
                productName: a.product.name,
                amount: Number(a.amount),
                tenor: a.tenorMonths,
                interestRate: Number(a.product.interestRate),
                purpose: a.purpose,
                status: a.status,
                submittedAt: (a.submittedAt || a.createdAt).toISOString(),
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/approvals error:", error);
        return NextResponse.json({ message: "Gagal memuat data approval" }, { status: 500 });
    }
}

// PATCH /api/mobile/approvals — Approve or Reject
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
