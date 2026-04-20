import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// PUT /api/toko/shifts/[id]/close — Tutup shift
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const shiftId = parseInt(id);
        const body = await request.json();
        const { closingCash, notes } = body;

        const sessionUser = await prisma.user.findUnique({
            where: { id: Number(session.user.id) },
            include: { role: true },
        });

        if (!sessionUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const shift = await prisma.cashierShift.findUnique({
            where: { id: shiftId },
        });

        if (!shift) {
            return NextResponse.json({ message: "Shift tidak ditemukan" }, { status: 404 });
        }

        if (shift.status === "closed") {
            return NextResponse.json({ message: "Shift sudah ditutup sebelumnya" }, { status: 400 });
        }

        const isOperator = sessionUser.role.name === "operator";
        const isAdmin = sessionUser.role.name === "admin";
        const isOwner = shift.userId === sessionUser.id;

        // Kasir hanya bisa tutup shift sendiri. Admin/Operator bisa tutup shift siapa saja.
        if (!isOwner && !isOperator && !isAdmin) {
            return NextResponse.json({ message: "Anda tidak memiliki akses untuk menutup shift ini" }, { status: 403 });
        }

        // Hitung total penjualan dari StoreSale yang terikat ke shift ini
        const salesAggregate = await prisma.storeSale.groupBy({
            by: ["paymentMethod"],
            where: { shiftId: shift.id },
            _sum: { totalAmount: true },
            _count: { id: true },
        });

        let totalCash = 0;
        let totalQris = 0;
        let totalCredit = 0;
        let totalTransactions = 0;

        for (const group of salesAggregate) {
            const amount = Number(group._sum.totalAmount || 0);
            const count = group._count.id;
            totalTransactions += count;

            if (group.paymentMethod === "cash") totalCash = amount;
            else if (group.paymentMethod === "qris") totalQris = amount;
            else if (group.paymentMethod === "salary_cut") totalCredit = amount;
        }

        // Kas yang seharusnya = modal awal + penjualan tunai
        const expectedCash = Number(shift.openingCash) + totalCash;

        // Selisih kas = uang fisik - kas seharusnya
        const cashDiff = closingCash != null ? (Number(closingCash) - expectedCash) : null;

        const updatedShift = await prisma.cashierShift.update({
            where: { id: shiftId },
            data: {
                status: "closed",
                endedAt: new Date(),
                closingCash: closingCash != null ? Number(closingCash) : null,
                expectedCash,
                totalSalesCash: totalCash,
                totalSalesQris: totalQris,
                totalSalesCredit: totalCredit,
                totalTransactions,
                cashDifference: cashDiff,
                notes: notes || null,
                closedByUserId: isOwner ? null : sessionUser.id,
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({
            message: `Shift "${updatedShift.shiftName}" berhasil ditutup.`,
            data: {
                id: updatedShift.id,
                shiftName: updatedShift.shiftName,
                userName: updatedShift.user.name,
                startedAt: updatedShift.startedAt.toISOString(),
                endedAt: updatedShift.endedAt?.toISOString(),
                openingCash: Number(updatedShift.openingCash),
                closingCash: closingCash != null ? Number(closingCash) : null,
                expectedCash,
                totalSalesCash: totalCash,
                totalSalesQris: totalQris,
                totalSalesCredit: totalCredit,
                totalTransactions,
                cashDifference: cashDiff,
                closedByUserId: updatedShift.closedByUserId,
                status: "closed",
            },
        });
    } catch (error) {
        console.error("PUT /api/toko/shifts/[id]/close error:", error);
        return NextResponse.json({ message: "Failed to close shift" }, { status: 500 });
    }
}
