import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// PUT /api/master/cash-bank/[id] — update a CashBankAccount
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        const body = await request.json();
        const { code, name, type, bankName, accountNumber, branchId, glAccountId, isActive, unitType } = body;

        const existing = await prisma.cashBankAccount.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return NextResponse.json(
                { message: "Akun Kas/Bank tidak ditemukan." },
                { status: 404 }
            );
        }

        // Validate unique code if it changed
        if (code && code !== existing.code) {
            const codeConflict = await prisma.cashBankAccount.findUnique({ where: { code } });
            if (codeConflict) {
                return NextResponse.json(
                    { message: `Kode "${code}" sudah digunakan oleh akun lain.` },
                    { status: 400 }
                );
            }
        }

        const updatedData: any = {};
        if (code !== undefined) updatedData.code = code;
        if (name !== undefined) updatedData.name = name;
        if (type !== undefined) updatedData.type = type;
        if (bankName !== undefined) updatedData.bankName = bankName;
        if (accountNumber !== undefined) updatedData.accountNumber = accountNumber;
        if (branchId !== undefined) updatedData.branchId = parseInt(branchId);
        if (glAccountId !== undefined) updatedData.glAccountId = glAccountId ? parseInt(glAccountId) : null;
        if (isActive !== undefined) updatedData.isActive = isActive;
        if (unitType !== undefined) updatedData.unitType = unitType || null;

        const updated = await prisma.cashBankAccount.update({
            where: { id },
            data: updatedData,
            include: {
                branch: { select: { id: true, name: true, code: true } },
                glAccount: { select: { id: true, code: true, name: true } },
            },
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/master/cash-bank/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal memperbarui akun Kas & Bank." },
            { status: 500 }
        );
    }
}

// DELETE /api/master/cash-bank/[id] — soft-delete a CashBankAccount
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);

        const existing = await prisma.cashBankAccount.findUnique({
            where: { id },
            include: { _count: { select: { transactions: true } } },
        });

        if (!existing || existing.deletedAt) {
            return NextResponse.json(
                { message: "Akun Kas/Bank tidak ditemukan." },
                { status: 404 }
            );
        }

        if (existing._count.transactions > 0) {
            // Soft-delete: mark inactive instead of real delete
            await prisma.cashBankAccount.update({
                where: { id },
                data: { isActive: false, deletedAt: new Date() },
            });
            return NextResponse.json({
                data: { id },
                message: `Akun "${existing.name}" telah dinonaktifkan. Tidak dapat dihapus permanen karena memiliki ${existing._count.transactions} transaksi terkait.`,
            });
        }

        // Hard delete if no transactions
        await prisma.cashBankAccount.delete({ where: { id } });
        return NextResponse.json({
            data: { id },
            message: `Akun "${existing.name}" berhasil dihapus permanen.`,
        });
    } catch (error) {
        console.error("DELETE /api/master/cash-bank/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal menghapus akun Kas & Bank." },
            { status: 500 }
        );
    }
}
