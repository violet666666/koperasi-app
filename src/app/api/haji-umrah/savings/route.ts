import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const HAJI_UMRAH_TYPES = ["tabungan_haji", "tabungan_umrah"];

// GET /api/haji-umrah/savings — List tabungan haji/umrah accounts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");
        const search = searchParams.get("search") || "";
        const type = searchParams.get("type"); // "tabungan_haji" | "tabungan_umrah"
        const status = searchParams.get("status"); // "active" | "closed"

        const types = type ? [type] : HAJI_UMRAH_TYPES;

        const where = {
            product: { type: { in: types }, deletedAt: null },
            ...(status && { status }),
            ...(search && {
                OR: [
                    { accountNo: { contains: search, mode: "insensitive" as const } },
                    { member: { name: { contains: search, mode: "insensitive" as const } } },
                    { member: { memberNo: { contains: search, mode: "insensitive" as const } } },
                    { member: { nrp: { contains: search, mode: "insensitive" as const } } },
                ],
            }),
        };

        const [accounts, total] = await Promise.all([
            prisma.savingsAccount.findMany({
                where,
                include: {
                    member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                    product: true,
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.savingsAccount.count({ where }),
        ]);

        // Enrich with progress data
        const enriched = accounts.map((acc) => {
            const balance = Number(acc.balance);
            const target = Number(acc.targetAmount ?? acc.product.targetAmount ?? 0);
            const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
            return {
                ...acc,
                balance,
                target,
                progress: Math.round(progress * 100) / 100,
                monthlyTarget: Number(acc.monthlyTarget ?? 0),
            };
        });

        return NextResponse.json({
            data: enriched,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/haji-umrah/savings error:", error);
        return NextResponse.json(
            { message: "Failed to fetch savings accounts" },
            { status: 500 }
        );
    }
}

// POST /api/haji-umrah/savings — Buka rekening tabungan haji/umrah
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = body;

        if (!memberId || !productId) {
            return NextResponse.json(
                { message: "memberId dan productId wajib diisi" },
                { status: 400 }
            );
        }

        // Validate product is haji/umrah type
        const product = await prisma.savingsProduct.findUnique({
            where: { id: productId },
        });
        if (!product || !HAJI_UMRAH_TYPES.includes(product.type)) {
            return NextResponse.json(
                { message: "Produk bukan tipe tabungan haji/umrah" },
                { status: 400 }
            );
        }

        // Get member
        const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: { id: true, branchId: true, status: true },
        });
        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check if account already exists (unique constraint: memberId + productId)
        const existing = await prisma.savingsAccount.findUnique({
            where: { memberId_productId: { memberId, productId } },
        });
        if (existing) {
            return NextResponse.json(
                { message: "Anggota sudah memiliki rekening untuk produk ini" },
                { status: 409 }
            );
        }

        const accountNo = `HU-${memberId}-${productId}-${Date.now().toString().slice(-4)}`;
        const effectiveTarget = targetAmount ?? product.targetAmount;

        const account = await prisma.savingsAccount.create({
            data: {
                accountNo,
                memberId,
                productId,
                branchId: member.branchId,
                balance: 0,
                openedDate: new Date(),
                targetAmount: effectiveTarget,
                monthlyTarget: monthlyTarget ?? null,
                maturityDate: maturityDate ? new Date(maturityDate) : null,
            },
            include: {
                member: { select: { id: true, memberNo: true, name: true, nrp: true } },
                product: true,
            },
        });

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error) {
        console.error("POST /api/haji-umrah/savings error:", error);
        return NextResponse.json(
            { message: "Failed to create savings account" },
            { status: 500 }
        );
    }
}
