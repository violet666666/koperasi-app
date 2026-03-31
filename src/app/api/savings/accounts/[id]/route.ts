import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request, context: { params: { id: string } }) {
    try {
        const { id } = context.params;
        const account = await prisma.savingsAccount.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: true,
                product: true,
            }
        });

        if (!account) return NextResponse.json({ message: "Not found" }, { status: 404 });
        return NextResponse.json({ data: account });
    } catch (error) {
        return NextResponse.json({ message: "Failed" }, { status: 500 });
    }
}

export async function PUT(request: Request, context: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role === "anggota") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { id } = context.params;
        const body = await request.json();
        const { status } = body;

        const updated = await prisma.savingsAccount.update({
            where: { id: parseInt(id) },
            data: { status }
        });

        return NextResponse.json({ data: updated, message: "Status rekening disimpan" });
    } catch (error) {
        return NextResponse.json({ message: "Gagal memperbarui rekening" }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role === "anggota") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { id } = context.params;

        const account = await prisma.savingsAccount.findUnique({
            where: { id: parseInt(id) },
            include: { transactions: { select: { id: true }, take: 1 } }
        });

        if (!account) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        // Validate strictly: only 0 balance and no transactions
        if (Number(account.balance) !== 0 || account.transactions.length > 0) {
            return NextResponse.json(
                { message: "Rekening tidak bisa dihapus karena memiliki saldo atau riwayat transaksi." },
                { status: 400 }
            );
        }

        await prisma.savingsAccount.delete({
            where: { id: parseInt(id) }
        });

        return NextResponse.json({ message: "Rekening berhasil dihapus." });
    } catch (error) {
        console.error("DELETE /api/savings/accounts/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus rekening." }, { status: 500 });
    }
}
