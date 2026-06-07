import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// PUT /api/toko/shifts/[id] — Admin edit closingCash on a closed shift
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const sessionUser = await prisma.user.findUnique({
            where: { id: Number(session.user.id) },
            include: { role: true },
        });
        if (!sessionUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const isOperator = ["operator"].includes(sessionUser.role.name);
        const isAdmin = sessionUser.role.name === "admin";
        if (!isOperator && !isAdmin) {
            return NextResponse.json({ message: "Hanya Admin/Operator yang dapat mengedit shift" }, { status: 403 });
        }

        const { id } = await params;
        const shiftId = parseInt(id);
        const body = await request.json();
        const { closingCash, notes } = body;

        if (closingCash === undefined || closingCash === null) {
            return NextResponse.json({ message: "closingCash wajib diisi" }, { status: 400 });
        }

        const shift = await prisma.cashierShift.findUnique({ where: { id: shiftId } });
        if (!shift) {
            return NextResponse.json({ message: "Shift tidak ditemukan" }, { status: 404 });
        }
        if (shift.status !== "closed") {
            return NextResponse.json({ message: "Hanya shift yang sudah ditutup yang dapat diedit" }, { status: 400 });
        }

        // Admin hanya bisa edit shift di unit sendiri
        if (isAdmin && !isSameUnit(shift.unitType, sessionUser.unitType)) {
            return NextResponse.json({ message: "Anda tidak memiliki akses ke shift di unit ini" }, { status: 403 });
        }

        // Recalculate cashDifference: newClosingCash - expectedCash
        const newClosingCash = Number(closingCash);
        const expectedCash = Number(shift.expectedCash || (Number(shift.openingCash) + Number(shift.totalSalesCash)));
        const newCashDifference = newClosingCash - expectedCash;

        const updated = await prisma.cashierShift.update({
            where: { id: shiftId },
            data: {
                closingCash: newClosingCash,
                cashDifference: newCashDifference,
                ...(notes !== undefined && { notes }),
            },
        });

        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "UPDATE",
                module: "Toko", unitType: "toko",
                description: `Edit closingCash shift #${shiftId}: ${Number(shift.closingCash)} → ${newClosingCash}`,
                newData: { shiftId, oldClosingCash: Number(shift.closingCash), newClosingCash, newCashDifference },
            });
        } catch { /* silent audit */ }

        return NextResponse.json({
            message: "ClosingCash shift berhasil diperbarui",
            data: {
                id: updated.id,
                closingCash: Number(updated.closingCash),
                expectedCash: Number(updated.expectedCash),
                cashDifference: Number(updated.cashDifference),
            },
        });
    } catch (error) {
        console.error("PUT /api/toko/shifts/[id] error:", error);
        return NextResponse.json({ message: "Gagal mengedit shift" }, { status: 500 });
    }
}
