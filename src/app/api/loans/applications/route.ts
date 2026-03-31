import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
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

        if (product.minTenorMonths && data.tenorMonths < product.minTenorMonths) {
            return NextResponse.json(
                { message: `Tenor minimal ${product.minTenorMonths} bulan` },
                { status: 400 }
            );
        }

        if (product.maxTenorMonths && data.tenorMonths > product.maxTenorMonths) {
            return NextResponse.json(
                { message: `Tenor maksimal ${product.maxTenorMonths} bulan` },
                { status: 400 }
            );
        }

        // === AD-ART Pasal 26: Validate salary remainder ===
        // Max pinjaman Rp 20.000.000
        const AD_ART_MAX_LOAN = 20000000;
        if (data.amount > AD_ART_MAX_LOAN) {
            return NextResponse.json(
                { message: `Sesuai AD-ART Pasal 26, pinjaman maksimal Rp 20.000.000` },
                { status: 400 }
            );
        }

        // Max tenor 3 tahun (36 bulan)
        const AD_ART_MAX_TENOR_MONTHS = 36;
        if (data.tenorMonths > AD_ART_MAX_TENOR_MONTHS) {
            return NextResponse.json(
                { message: `Sesuai AD-ART Pasal 26, tenor pinjaman maksimal 3 tahun (36 bulan)` },
                { status: 400 }
            );
        }

        // Get member salary and existing active loan installments
        const memberFull = await prisma.member.findUnique({
            where: { id: data.memberId },
            select: {
                salary: true,
                loans: {
                    where: { status: "active" },
                    select: { monthlyInstallment: true },
                },
            },
        });

        if (memberFull?.salary) {
            const salary = Number(memberFull.salary);
            const existingInstallments = memberFull.loans.reduce(
                (sum, loan) => sum + Number(loan.monthlyInstallment),
                0
            );

            // Calculate new loan monthly installment with new Koperasi rule (1% admin fee capitalization)
            const adminFee = data.amount * 0.01;
            const totalLoan = data.amount + adminFee;
            const newInstallment = totalLoan / data.tenorMonths;

            const salaryRemainder = salary - existingInstallments - newInstallment;
            const MIN_SALARY_REMAINDER = 2000000; // Rp 2.000.000

            if (salaryRemainder < MIN_SALARY_REMAINDER) {
                return NextResponse.json(
                    {
                        message: `Sesuai AD-ART Pasal 26, sisa gaji setelah pemotongan angsuran minimal Rp 2.000.000. Sisa gaji Anda: Rp ${Math.round(salaryRemainder).toLocaleString("id-ID")}`,
                        details: {
                            salary,
                            existingInstallments: Math.round(existingInstallments),
                            newInstallment: Math.round(newInstallment),
                            salaryRemainder: Math.round(salaryRemainder),
                            minimumRequired: MIN_SALARY_REMAINDER,
                        },
                    },
                    { status: 400 }
                );
            }
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
                notes: data.notes,
                status: "draft",
                createdById: 1, // TODO: Get from session
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
