import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { id } = await context.params;
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

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role === "anggota") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { id } = await context.params;
        const body = await request.json();
        const { status, accountNo, openedDate } = body;

        const account = await prisma.savingsAccount.findUnique({
            where: { id: parseInt(id) },
        });

        if (!account) {
            return NextResponse.json({ message: "Rekening tidak ditemukan" }, { status: 404 });
        }

        // Validasi duplikat nomor rekening jika diubah
        if (accountNo && accountNo !== account.accountNo) {
            const existing = await prisma.savingsAccount.findUnique({
                where: { accountNo },
            });
            if (existing) {
                return NextResponse.json(
                    { message: `Nomor rekening "${accountNo}" sudah digunakan oleh anggota lain.` },
                    { status: 400 }
                );
            }
        }

        // Guard: prevent closing/blocking account with non-zero balance
        if (status && status !== "active" && Number(account.balance) !== 0) {
            return NextResponse.json(
                { message: `Rekening tidak dapat ditutup/diblokir karena masih memiliki saldo Rp ${Number(account.balance).toLocaleString("id-ID")}. Kosongkan saldo terlebih dahulu.` },
                { status: 400 }
            );
        }

        const updateData: Record<string, any> = {};
        if (status) updateData.status = status;
        if (accountNo) updateData.accountNo = accountNo;
        if (openedDate) updateData.openedDate = new Date(openedDate);

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ message: "Tidak ada data yang diubah" }, { status: 400 });
        }

        const updated = await prisma.savingsAccount.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: { member: true, product: true },
        });

        return NextResponse.json({ data: updated, message: "Rekening berhasil diperbarui" });
    } catch (error: any) {
        console.error("PUT /api/savings/accounts/[id] error:", error);
        const msg = error?.code === 'P2002' ? "Nomor rekening sudah digunakan." : "Gagal memperbarui rekening";
        return NextResponse.json({ message: msg }, { status: 500 });
    }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const session = await auth();
        if (!session?.user || session.user.role === "anggota") {
            return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
        }

        const { id } = await context.params;

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
