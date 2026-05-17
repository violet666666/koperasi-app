import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paginationSchema } from "@/lib/validations";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp"];

// GET /api/cash-bank/accounts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const type = searchParams.get("type"); // cash or bank

        const where = {
            deletedAt: null,
            isActive: true,
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(type && { type }),
        };

        const accounts = await prisma.cashBankAccount.findMany({
            where,
            include: {
                branch: { select: { id: true, name: true } },
            },
            orderBy: { code: "asc" },
        });

        return NextResponse.json({ data: accounts });
    } catch (error) {
        console.error("GET /api/cash-bank/accounts error:", error);
        return NextResponse.json(
            { message: "Failed to fetch accounts" },
            { status: 500 }
        );
    }
}

// POST /api/cash-bank/accounts
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, name, type, bankName, accountNumber, branchId, glAccountId } = body;

        if (!code || !name || !type || !branchId) {
            return NextResponse.json(
                { message: "Data tidak lengkap" },
                { status: 400 }
            );
        }

        const existing = await prisma.cashBankAccount.findUnique({
            where: { code },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Kode akun sudah digunakan" },
                { status: 400 }
            );
        }

        const account = await prisma.cashBankAccount.create({
            data: {
                code,
                name,
                type,
                bankName,
                accountNumber,
                branchId,
                glAccountId,
                currentBalance: 0,
                isActive: true,
            },
        });

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error) {
        console.error("POST /api/cash-bank/accounts error:", error);
        return NextResponse.json(
            { message: "Failed to create account" },
            { status: 500 }
        );
    }
}
