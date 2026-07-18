import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// GET /api/mobile/loans/applications — Daftar pengajuan pinjaman (read-only, operator/admin_sp)
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    const roleName = mobileUser.role;
    if (!["operator", "admin_sp"].includes(roleName)) {
        return NextResponse.json({ message: "Hanya Operator yang dapat mengakses." }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status");
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");

        const where = {
            ...(status && status !== "all" ? { status } : {}),
        };

        const [applications, total, submitted, approved, rejected] = await Promise.all([
            prisma.loanApplication.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: { select: { id: true, code: true, name: true, interestRate: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.loanApplication.count({ where }),
            prisma.loanApplication.count({ where: { status: "submitted" } }),
            prisma.loanApplication.count({ where: { status: "approved" } }),
            prisma.loanApplication.count({ where: { status: "rejected" } }),
        ]);

        return NextResponse.json({
            data: applications.map((app) => ({
                id: app.id,
                applicationNo: app.applicationNo,
                memberName: app.member.name,
                memberNo: app.member.memberNo,
                nrp: app.member.nrp,
                productName: app.product.name,
                productCode: app.product.code,
                interestRate: Number(app.product.interestRate),
                amount: Number(app.amount),
                tenorMonths: app.tenorMonths,
                purpose: app.purpose,
                notes: app.notes,
                status: app.status,
                deductionSource: app.deductionSource,
                rejectionReason: app.rejectionReason,
                createdAt: app.createdAt,
                submittedAt: app.submittedAt,
                approvedAt: app.approvedAt,
                rejectedAt: app.rejectedAt,
            })),
            summary: {
                submitted,
                approved,
                rejected,
            },
            pagination: {
                page,
                perPage,
                totalItems: total,
                totalPages: Math.max(1, Math.ceil(total / perPage)),
            },
        });
    } catch (error) {
        console.error("GET /api/mobile/loans/applications error:", error);
        return NextResponse.json({ message: "Gagal memuat data pengajuan" }, { status: 500 });
    }
}
