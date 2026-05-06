import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "super_admin"];

// GET /api/receipts - List receipts
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1");
        const perPage = parseInt(searchParams.get("perPage") || "15");
        const status = searchParams.get("status");
        const search = searchParams.get("search");

        const where: Record<string, unknown> = {};

        if (status && status !== "all") {
            where.status = status;
        }

        if (search) {
            where.OR = [
                { receiptNo: { contains: search, mode: "insensitive" } },
                { description: { contains: search, mode: "insensitive" } },
                { receivedFrom: { contains: search, mode: "insensitive" } },
                { member: { name: { contains: search, mode: "insensitive" } } },
            ];
        }

        const [receipts, total] = await Promise.all([
            prisma.receipt.findMany({
                where,
                include: {
                    member: {
                        select: {
                            id: true,
                            memberNo: true,
                            nrp: true,
                            name: true,
                        },
                    },
                    createdBy: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * perPage,
                take: perPage,
            }),
            prisma.receipt.count({ where }),
        ]);

        return NextResponse.json({
            data: receipts,
            meta: {
                page,
                perPage,
                total,
                totalPages: Math.ceil(total / perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/receipts error:", error);
        return NextResponse.json(
            { message: "Failed to fetch receipts" },
            { status: 500 }
        );
    }
}

// POST /api/receipts - Create receipt draft
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        if (!ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await request.json();
        const { memberId, type, referenceNo, amount, description, receivedFrom, paymentMethod, notes, receiptDate } = body;

        if (!memberId || !type || !amount || !description || !receivedFrom || !receiptDate) {
            return NextResponse.json(
                { message: "Data tidak lengkap. Mohon isi semua field yang wajib." },
                { status: 400 }
            );
        }

        // Generate receipt number
        const now = new Date();
        const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
        const count = await prisma.receipt.count();
        const receiptNo = `KW-${yearMonth}-${String(count + 1).padStart(4, "0")}`;

        const receipt = await prisma.receipt.create({
            data: {
                receiptNo,
                memberId: parseInt(memberId),
                type,
                referenceNo: referenceNo || null,
                amount: parseFloat(amount),
                description,
                receivedFrom,
                paymentMethod: paymentMethod || "cash",
                notes: notes || null,
                receiptDate: new Date(receiptDate),
                status: "draft",
                createdById: parseInt(session.user.id),
            },
            include: {
                member: {
                    select: {
                        id: true,
                        memberNo: true,
                        nrp: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: receipt }, { status: 201 });
    } catch (error) {
        console.error("POST /api/receipts error:", error);
        return NextResponse.json(
            { message: "Failed to create receipt" },
            { status: 500 }
        );
    }
}
