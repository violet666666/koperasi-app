import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

// GET /api/approvals
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const statusParam = searchParams.get("status");
        const typeFilter = searchParams.get("type");
        const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25", 10)));
        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || roleName === "admin_sp" || session.user.permissions?.includes("manage_all");
        
        const isSimpanPinjamAdmin = roleName === "admin" && userUnitType === "simpan_pinjam";
        const isUnitAdmin = roleName === "admin" && userUnitType && userUnitType !== "simpan_pinjam";

        // ── 1. Loan Applications ─────────────────────────────────────────────
        let loanStatusFilter = {};
        if (statusParam === "pending") {
            loanStatusFilter = { status: "submitted" };
        } else if (statusParam === "history") {
            loanStatusFilter = { status: { in: ["approved", "rejected", "disbursed", "cancelled"] } };
        }

        // Only Operator or Simpan Pinjam Admin can see loans
        const canSeeLoans = isOperator || isSimpanPinjamAdmin;

        const loanApplications =
            (!canSeeLoans || (typeFilter && typeFilter !== "loan"))
                ? []
                : await prisma.loanApplication.findMany({
                      where: {
                          ...(branchId && { branchId: parseInt(branchId) }),
                          ...loanStatusFilter,
                      },
                      include: {
                          member: { select: { id: true, memberNo: true, name: true } },
                          branch: { select: { id: true, name: true } },
                          product: { select: { id: true, code: true, name: true } },
                      },
                      orderBy: { submittedAt: "desc" },
                  });

        const loanApprovals = loanApplications.map((app) => ({
            id: `loan_${app.id}`,
            requestType: "loan_application",
            referenceId: app.id,
            referenceNo: app.applicationNo,
            description: `Pengajuan Pinjaman ${app.product.name} oleh ${app.member.name}`,
            amount: Number(app.amount),
            branchId: app.branchId || 1,
            status: app.status === "submitted" ? "pending" : app.status,
            requestedBy: app.member,
            requestedAt: app.submittedAt,
            processedAt: app.approvedAt || app.rejectedAt || undefined,
            notes: app.rejectionReason || undefined,
            metadata: {
                tenorMonths: app.tenorMonths,
                purpose: app.purpose,
                deductionSource: app.deductionSource,
                productName: app.product.name,
                memberNo: app.member.memberNo,
            },
        }));

        // ── 2. Unit Void Requests ─────────────────────────────────────────────
        let voidStatusFilter: Record<string, unknown> = {};
        if (statusParam === "pending") {
            voidStatusFilter = { status: "pending" };
        } else if (statusParam === "history") {
            voidStatusFilter = { status: { in: ["approved", "rejected"] } };
        }

        const voidRequests =
            (typeFilter && typeFilter !== "unit_void" && typeFilter !== "laporan_unit")
                ? []
                : await prisma.approvalRequest.findMany({
                      where: {
                          type: { in: ["unit_void", "void_store_sale", "laporan_unit"] },
                          ...voidStatusFilter,
                      },
                      include: {
                          requestedBy: { select: { id: true, name: true } },
                      },
                      orderBy: { requestedAt: "desc" },
                  });

        const voidApprovals = voidRequests
            .filter((req) => {
                // If Operator or SP Admin, can see all voids probably? Or Simpan Pinjam Admin shouldn't see Cuci Mobil Voids? 
                // Operator can see everything.
                if (isOperator) return true;
                
                // If Admin Unit, ONLY see their own unitType voids
                if (isUnitAdmin) {
                    const meta: any = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata || {};
                    return meta.unitType === userUnitType;
                }
                
                // Simpan Pinjam Admin generally only handles SP
                if (isSimpanPinjamAdmin) {
                    const meta: any = typeof req.metadata === 'string' ? JSON.parse(req.metadata) : req.metadata || {};
                    return meta.unitType === "simpan_pinjam";
                }
                
                return false;
            })
            .map((req) => ({
            id: `void_${req.id}`,
            requestType: req.type,
            referenceId: req.id,
            referenceNo: req.requestNo,
            requestNo: req.requestNo,
            description: req.description,
            amount: req.amount ? Number(req.amount) : 0,
            branchId: req.branchId,
            status: req.status,
            requestedBy: req.requestedBy,
            requestedAt: req.requestedAt,
            processedAt: req.approvedAt || req.rejectedAt || undefined,
            notes: req.rejectionReason || undefined,
            metadata: req.metadata || {},
        }));

        // ── Gabungkan & urutkan ───────────────────────────────────────────────
        const allApprovals = [...loanApprovals, ...voidApprovals].sort(
            (a, b) =>
                new Date(b.requestedAt || 0).getTime() -
                new Date(a.requestedAt || 0).getTime()
        );

        const total = allApprovals.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const skip = (page - 1) * perPage;
        const paginatedData = allApprovals.slice(skip, skip + perPage);

        // Build void count filter based on user scope
        // Operator sees all; admin unit only sees their own unitType
        const buildVoidCountWhere = (statusFilter: string | Record<string, unknown>) => {
            const base: Record<string, unknown> = {
                type: { in: ["unit_void", "void_store_sale", "laporan_unit"] },
                status: statusFilter,
            };
            if (isUnitAdmin && userUnitType) {
                base.metadata = { path: ["unitType"], equals: userUnitType };
            } else if (isSimpanPinjamAdmin) {
                base.metadata = { path: ["unitType"], equals: "simpan_pinjam" };
            }
            return base;
        };

        // Hitung pending count dari data mentah (sebelum statusParam filter)
        // agar badge selalu akurat terlepas dari tab aktif
        const [pendingLoanCount, pendingVoidCount] = await Promise.all([
            canSeeLoans
                ? prisma.loanApplication.count({ where: { status: "submitted", ...(branchId ? { branchId: parseInt(branchId) } : {}) } })
                : Promise.resolve(0),
            prisma.approvalRequest.count({ where: buildVoidCountWhere("pending") as any }),
        ]);
        const pendingCount = pendingLoanCount + pendingVoidCount;

        // Total approved/rejected counts for summary cards
        const [approvedLoanCount, rejectedLoanCount, approvedVoidCount, rejectedVoidCount] = await Promise.all([
            canSeeLoans
                ? prisma.loanApplication.count({ where: { status: { in: ["approved", "disbursed"] }, ...(branchId ? { branchId: parseInt(branchId) } : {}) } })
                : Promise.resolve(0),
            canSeeLoans
                ? prisma.loanApplication.count({ where: { status: "rejected", ...(branchId ? { branchId: parseInt(branchId) } : {}) } })
                : Promise.resolve(0),
            prisma.approvalRequest.count({ where: buildVoidCountWhere("approved") as any }),
            prisma.approvalRequest.count({ where: buildVoidCountWhere("rejected") as any }),
        ]);

        return NextResponse.json({
            data: paginatedData,
            pendingCount,
            approvedCount: approvedLoanCount + approvedVoidCount,
            rejectedCount: rejectedLoanCount + rejectedVoidCount,
            pagination: { page, perPage, total, totalPages },
        });
    } catch (error) {
        console.error("GET /api/approvals error:", error);
        return NextResponse.json(
            { message: "Failed to fetch approvals" },
            { status: 500 }
        );
    }
}
