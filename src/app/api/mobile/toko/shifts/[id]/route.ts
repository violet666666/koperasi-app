import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// PUT /api/mobile/toko/shifts/[id] — Menutup shift
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        const userId = Number(user.id);
        const role = (user as any).role;
        const isOperator = role === "operator";
        const isAdmin = role === "admin";
        const isOwner = userId === Number(params.id); // will check below

        const shiftId = Number(params.id);
        const body = await request.json();
        const { closingCash, notes } = body;

        if (closingCash === undefined || closingCash === null) {
            return NextResponse.json({ message: "closingCash wajib diisi" }, { status: 400 });
        }

        const shift = await prisma.cashierShift.findUnique({
            where: { id: shiftId },
        });

        if (!shift) {
            return NextResponse.json({ message: "Shift tidak ditemukan" }, { status: 404 });
        }

        if (shift.status !== "open") {
            return NextResponse.json({ message: "Shift sudah ditutup sebelumnya" }, { status: 400 });
        }

        // Authorization: hanya owner shift, admin, atau operator yang bisa menutup
        const isShiftOwner = shift.userId === userId;
        if (!isShiftOwner && !isAdmin && !isOperator) {
            return NextResponse.json({ message: "Anda tidak diizinkan menutup shift ini" }, { status: 403 });
        }

        // Kalkulasi total sales selama shift ini (gunakan shiftId bukan time-based)
        const sales = await prisma.storeSale.findMany({
            where: {
                shiftId: shift.id,
            },
        });

        let totalSalesCash = 0;
        let totalSalesQris = 0;
        let totalSalesCredit = 0;
        let activeCount = 0;

        for (const sale of sales) {
            // Cek jika dibatalkan (void) jangan dihitung
            const metadata: any = sale.metadata && typeof sale.metadata === "object" ? sale.metadata : {};
            if (metadata.isVoided) continue;

            activeCount++;
            const amount = Number(sale.totalAmount);
            if (sale.paymentMethod === "cash") totalSalesCash += amount;
            else if (sale.paymentMethod === "qris" || sale.paymentMethod === "transfer") totalSalesQris += amount;
            else if (sale.paymentMethod === "credit" || sale.paymentMethod === "salary_cut") totalSalesCredit += amount;
        }

        // expectedCash = uang awal + total penjualan cash
        const expectedCash = Number(shift.openingCash) + totalSalesCash;
        const cashDifference = Number(closingCash) - expectedCash;

        // Jika owner yang menutup sendiri, closedByUserId = null (sesuai web)
        const closedByUserId = isShiftOwner ? null : userId;

        const updatedShift = await prisma.cashierShift.update({
            where: { id: shiftId },
            data: {
                status: "closed",
                endedAt: new Date(),
                closingCash,
                expectedCash,
                totalSalesCash,
                totalSalesQris,
                totalSalesCredit,
                totalTransactions: activeCount,
                cashDifference,
                notes,
                closedByUserId,
            },
        });

        return NextResponse.json({
            message: "Shift berhasil ditutup",
            data: {
                id: updatedShift.id,
                status: updatedShift.status,
                cashDifference,
            },
        });
    } catch (error) {
        console.error("PUT /api/mobile/toko/shifts/[id] error:", error);
        return NextResponse.json({ message: "Gagal menutup shift" }, { status: 500 });
    }
}
