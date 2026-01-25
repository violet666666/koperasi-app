import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updateMemberSchema } from "@/lib/validations";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/members/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
            include: {
                branch: true,
                savingsAccounts: {
                    include: {
                        product: true,
                    },
                },
                loans: {
                    where: { status: "active" },
                },
            },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: member });
    } catch (error) {
        console.error("GET /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member" },
            { status: 500 }
        );
    }
}

// GET /api/members/[id]/summary - Financial summary
export async function getSummary(memberId: number) {
    const member = await prisma.member.findUnique({
        where: { id: memberId },
        include: {
            savingsAccounts: {
                include: { product: true },
            },
            loans: {
                where: { status: "active" },
            },
        },
    });

    if (!member) return null;

    const totalSavings = member.savingsAccounts.reduce(
        (sum, acc) => sum + Number(acc.balance),
        0
    );

    const savingsByType = member.savingsAccounts.map((acc) => ({
        type: acc.product.type,
        name: acc.product.name,
        balance: Number(acc.balance),
    }));

    const activeLoans = member.loans.filter((l) => l.status === "active");
    const totalOutstanding = activeLoans.reduce(
        (sum, l) => sum + Number(l.principalOutstanding) + Number(l.interestOutstanding),
        0
    );

    return {
        memberId: member.id,
        memberNo: member.memberNo,
        name: member.name,
        savings: {
            total: totalSavings,
            byType: savingsByType,
        },
        loans: {
            activeCount: activeLoans.length,
            totalOutstanding,
        },
        netPosition: totalSavings - totalOutstanding,
    };
}

// PUT /api/members/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const body = await request.json();
        const data = updateMemberSchema.parse(body);

        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for duplicate memberNo if being updated
        if (data.memberNo && data.memberNo !== member.memberNo) {
            const existing = await prisma.member.findUnique({
                where: { memberNo: data.memberNo },
            });
            if (existing) {
                return NextResponse.json(
                    { message: "Nomor anggota sudah digunakan" },
                    { status: 400 }
                );
            }
        }

        const updated = await prisma.member.update({
            where: { id: parseInt(id) },
            data,
            include: { branch: true },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update member" },
            { status: 500 }
        );
    }
}

// DELETE /api/members/[id] - Soft delete
export async function DELETE(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!member) {
            return NextResponse.json(
                { message: "Anggota tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for active loans
        const activeLoans = await prisma.loan.count({
            where: { memberId: parseInt(id), status: "active" },
        });

        if (activeLoans > 0) {
            return NextResponse.json(
                { message: "Anggota masih memiliki pinjaman aktif" },
                { status: 400 }
            );
        }

        // Soft delete
        await prisma.member.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date(), status: "resigned" },
        });

        return NextResponse.json({ message: "Anggota berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/members/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to delete member" },
            { status: 500 }
        );
    }
}
