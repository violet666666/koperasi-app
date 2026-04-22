import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

// PUT /api/mobile/toko/shifts/[id] — Menutup shift
export async function PUT(request: Request, { params }: { params: { id: string } }) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

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

        // Kalkulasi total sales selama shift ini
        const sales = await prisma.storeSale.findMany({
            where: {
                createdById: shift.userId,
                unitType: shift.unitType,
                createdAt: {
                    gte: shift.startedAt,
                },
            },
        });

        let totalSalesCash = 0;
        let totalSalesQris = 0;
        let totalSalesCredit = 0;

        for (const sale of sales) {
            // Cek jika dibatalkan (void) jangan dihitung
            const metadata: any = sale.metadata && typeof sale.metadata === "object" ? sale.metadata : {};
            if (metadata.isVoided) continue;

            const amount = Number(sale.totalAmount);
            if (sale.paymentMethod === "cash") totalSalesCash += amount;
            else if (sale.paymentMethod === "qris" || sale.paymentMethod === "transfer") totalSalesQris += amount;
            else if (sale.paymentMethod === "credit" || sale.paymentMethod === "salary_cut") totalSalesCredit += amount;
        }

        // expectedCash = uang awal + total penjualan cash
        const expectedCash = Number(shift.openingCash) + totalSalesCash;
        const cashDifference = Number(closingCash) - expectedCash;

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
                totalTransactions: sales.length,
                cashDifference,
                notes,
                closedByUserId: Number(user.id),
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
