import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/loans/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const loan = await prisma.loan.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: {
                    select: { id: true, memberNo: true, name: true, phone: true },
                },
                branch: { select: { id: true, name: true } },
                application: true,
                schedules: {
                    orderBy: { installmentNo: "asc" },
                },
                payments: {
                    orderBy: { paymentDate: "desc" },
                    take: 10,
                },
            },
        });

        if (!loan) {
            return NextResponse.json(
                { message: "Pinjaman tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: loan });
    } catch (error) {
        console.error("GET /api/loans/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch loan" },
            { status: 500 }
        );
    }
}
