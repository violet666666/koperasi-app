import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { createLoanApplicationSchema, paginationSchema } from "@/lib/validations";

// Helper to generate application number
function generateApplicationNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `APP-${year}-${random}`;
}

// GET /api/loans/applications
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Hanya Operator yang dapat mengakses data pengajuan." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "createdAt",
            sortOrder: searchParams.get("sortOrder") || "desc",
        });

        const memberId = searchParams.get("memberId");
        const branchId = searchParams.get("branchId");
        const status = searchParams.get("status");

        const where = {
            ...(memberId && { memberId: parseInt(memberId) }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(status && { status }),
        };

        const [applications, total] = await Promise.all([
            prisma.loanApplication.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true } },
                    product: { select: { id: true, code: true, name: true, interestRate: true } },
                    branch: { select: { id: true, name: true } },
                },
                orderBy: { [query.sortBy || "createdAt"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.loanApplication.count({ where }),
        ]);

        return NextResponse.json({
            data: applications,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/loans/applications error:", error);
        return NextResponse.json(
            { message: "Failed to fetch applications" },
            { status: 500 }
        );
    }
}

// POST /api/loans/applications - Create loan application
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (roleName !== "operator") {
            return NextResponse.json({ message: "Hanya Operator yang dapat membuat pengajuan pinjaman." }, { status: 403 });
        }
        const currentUserId = parseInt(session.user.id);
        const body = await request.json();
        const data = createLoanApplicationSchema.parse(body);

        const member = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: { branchId: true, status: true },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        if (member.status !== "active") {
            return NextResponse.json(
                { message: "Anggota tidak aktif" },
                { status: 400 }
            );
        }

        const product = await prisma.loanProduct.findFirst({
            where: { id: data.productId, isActive: true, isCurrent: true },
        });

        if (!product) {
            return NextResponse.json(
                { message: "Produk pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        // Validate amount and tenor
        if (product.minAmount && data.amount < Number(product.minAmount)) {
            return NextResponse.json(
                { message: `Jumlah pinjaman minimal ${product.minAmount}` },
                { status: 400 }
            );
        }

        if (product.maxAmount && data.amount > Number(product.maxAmount)) {
            return NextResponse.json(
                { message: `Jumlah pinjaman maksimal ${product.maxAmount}` },
                { status: 400 }
            );
        }

        // Validate tenor against product limits ONLY (no hardcoded AD-ART limits)
        if (product.minTenorMonths && data.tenorMonths < product.minTenorMonths) {
            return NextResponse.json(
                { message: `Tenor minimal ${product.minTenorMonths} bulan untuk produk ${product.name}` },
                { status: 400 }
            );
        }

        if (product.maxTenorMonths && data.tenorMonths > product.maxTenorMonths) {
            return NextResponse.json(
                { message: `Tenor maksimal ${product.maxTenorMonths} bulan untuk produk ${product.name}` },
                { status: 400 }
            );
        }

        // Get member salary, tunkin, and existing active loan installments
        const memberFull = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: {
                salary: true,
                tunlesKinerja: true,
                loans: {
                    where: { status: "active" },
                    select: { monthlyInstallment: true },
                },
            },
        });

        if (memberFull) {
            // BS (Bayar Sendiri): skip income validation — anggota bayar langsung
            if (data.deductionSource !== "bs") {
                // Determine which income source to check based on deductionSource
                const incomeSource = data.deductionSource === "tunkin" ? Number(memberFull.tunlesKinerja || 0) : Number(memberFull.salary || 0);
                const sourceLabel = data.deductionSource === "tunkin" ? "Tunjangan Kinerja" : "Gaji";

                if (incomeSource > 0) {
                    const existingInstallments = memberFull.loans.reduce(
                        (sum, loan) => sum + Number(loan.monthlyInstallment),
                        0
                    );

                    // Calculate new loan monthly installment based on product rate (Flat)
                    const ratePerMonth = Number(product.interestRate) / 100; // e.g. 1% → 0.01
                    const interestPerMonth = data.amount * ratePerMonth;
                    const totalInterest = interestPerMonth * data.tenorMonths;
                    const totalLoan = data.amount + totalInterest;
                    const newInstallment = totalLoan / data.tenorMonths;

                    const incomeRemainder = incomeSource - existingInstallments - newInstallment;
                    const MIN_INCOME_REMAINDER = 2000000; // Rp 2.000.000

                    if (incomeRemainder < MIN_INCOME_REMAINDER) {
                        return NextResponse.json(
                            {
                                message: `Sesuai AD-ART Pasal 26, sisa ${sourceLabel} setelah pemotongan angsuran minimal Rp 2.000.000. Sisa ${sourceLabel} Anda: Rp ${Math.round(incomeRemainder).toLocaleString("id-ID")}`,
                                details: {
                                    incomeSource,
                                    existingInstallments: Math.round(existingInstallments),
                                    newInstallment: Math.round(newInstallment),
                                    incomeRemainder: Math.round(incomeRemainder),
                                    minimumRequired: MIN_INCOME_REMAINDER,
                                },
                            },
                            { status: 400 }
                        );
                    }
                }
            }
        }

        // Format Notes & CreatedAt conditionally for backdating
        let finalNotes = data.notes;
        let forcedCreatedAt: Date | undefined = undefined;

        if (data.backdatedDate && session.user.permissions?.includes("manage_all")) {
            forcedCreatedAt = new Date(data.backdatedDate);
            const backdateTag = `[BACKDATED_TO:${data.backdatedDate}]`;
            finalNotes = finalNotes ? `${finalNotes}\n${backdateTag}` : backdateTag;
        }

        const application = await prisma.loanApplication.create({
            data: {
                applicationNo: generateApplicationNo(),
                memberId: data.memberId,
                branchId: member.branchId,
                productId: data.productId,
                amount: data.amount,
                tenorMonths: data.tenorMonths,
                purpose: data.purpose,
                collateralDescription: data.collateralDescription,
                deductionSource: data.deductionSource,
                notes: finalNotes,
                status: "draft",
                createdById: currentUserId,
                createdAt: forcedCreatedAt,
                submittedAt: forcedCreatedAt,
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true } },
                product: true,
                branch: true,
            },
        });

        return NextResponse.json({ data: application }, { status: 201 });
    } catch (error) {
        console.error("POST /api/loans/applications error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create application" },
            { status: 500 }
        );
    }
}
