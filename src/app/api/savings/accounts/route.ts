import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");
        const search = searchParams.get("search");

        const where: any = {};
        if (search) {
            where.OR = [
                { accountNo: { contains: search, mode: "insensitive" } },
                { member: { name: { contains: search, mode: "insensitive" } } },
                { member: { memberNo: { contains: search, mode: "insensitive" } } },
                { member: { nrp: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [accounts, total] = await Promise.all([
            prisma.savingsAccount.findMany({
                where,
                include: {
                    member: {
                        select: { id: true, memberNo: true, nrp: true, name: true, branch: { select: { name: true } } }
                    },
                    product: {
                        select: { id: true, name: true, type: true }
                    }
                },
                orderBy: { openedDate: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsAccount.count({ where })
        ]);

        return NextResponse.json({
            data: accounts,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            }
        });
    } catch (error) {
        console.error("GET /api/savings/accounts error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings accounts" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role === "anggota") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const body = await request.json();
        const { memberId, productId } = body;

        if (!memberId || !productId) {
            return NextResponse.json({ message: "Member ID and Product ID are required." }, { status: 400 });
        }

        // Fetch member branch to associate
        const member = await prisma.member.findUnique({
            where: { id: parseInt(memberId) },
            select: { branchId: true }
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan." }, { status: 404 });
        }

        // Check if account already exists for this member + product
        const existingAccount = await prisma.savingsAccount.findFirst({
            where: {
                memberId: parseInt(memberId),
                productId: parseInt(productId)
            }
        });

        if (existingAccount) {
            return NextResponse.json(
                { message: "Anggota sudah memiliki rekening untuk produk simpanan ini." },
                { status: 400 }
            );
        }

        const accountNo = `SAV-${memberId}-${productId}-${Date.now().toString().slice(-4)}`;

        const newAccount = await prisma.savingsAccount.create({
            data: {
                accountNo,
                memberId: parseInt(memberId),
                productId: parseInt(productId),
                branchId: member.branchId,
                balance: 0,
                openedDate: new Date(),
                status: "active"
            }
        });

        return NextResponse.json({ data: newAccount, message: "Rekening berhasil dibuka." }, { status: 201 });
    } catch (error) {
        console.error("POST /api/savings/accounts error:", error);
        return NextResponse.json(
            { message: "Gagal membuat rekening." },
            { status: 500 }
        );
    }
}
