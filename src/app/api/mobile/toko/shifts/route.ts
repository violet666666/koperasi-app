import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

// Definisi jadwal shift
const SHIFT_SCHEDULE = [
    { name: "Pagi", startHour: 8, endHour: 15 },
    { name: "Siang", startHour: 15, endHour: 21 },
    { name: "Malam", startHour: 21, endHour: 8 }, // crosses midnight
];

// GET /api/mobile/toko/shifts — List shifts
// Kasir: hanya shift milik sendiri
// Admin Toko / Operator: semua shift di unit mereka
export async function GET(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status"); // "open" | "closed" | null (all)
        const userId = searchParams.get("userId");
        const unitType = searchParams.get("unitType");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const limit = parseInt(searchParams.get("limit") || "50");

        const isOperator = user.role === "operator" || user.isOperator;
        const isAdmin = user.role === "admin";
        const isKasir = user.role === "kasir";

        // Build where clause
        const where: any = {};

        if (status) where.status = status;
        if (unitType) where.unitType = unitType;

        // Kasir hanya bisa lihat shift sendiri
        if (isKasir) {
            where.userId = Number(user.id);
        } else if (isAdmin) {
            // Admin hanya lihat shift di unit-nya
            if ((user as any).unitType) where.unitType = (user as any).unitType;
            if (userId) where.userId = parseInt(userId);
        } else if (isOperator) {
            // Operator bisa lihat semua
            if (userId) where.userId = parseInt(userId);
        }

        if (dateFrom) {
            where.startedAt = { ...where.startedAt, gte: new Date(dateFrom) };
        }
        if (dateTo) {
            where.startedAt = { ...where.startedAt, lte: new Date(dateTo + "T23:59:59Z") };
        }

        const shifts = await prisma.cashierShift.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, email: true } },
                _count: { select: { storeSales: true } },
            },
            orderBy: { startedAt: "desc" },
            take: limit,
        });

        return NextResponse.json({
            data: shifts.map((s: any) => ({
                id: s.id,
                userId: s.userId,
                userName: s.user.name,
                unitType: s.unitType,
                shiftName: s.shiftName,
                startedAt: s.startedAt.toISOString(),
                endedAt: s.endedAt?.toISOString() || null,
                openingCash: Number(s.openingCash),
                closingCash: s.closingCash ? Number(s.closingCash) : null,
                expectedCash: s.expectedCash ? Number(s.expectedCash) : null,
                totalSalesCash: Number(s.totalSalesCash),
                totalSalesQris: Number(s.totalSalesQris),
                totalSalesCredit: Number(s.totalSalesCredit),
                totalTransactions: s.totalTransactions,
                cashDifference: s.cashDifference ? Number(s.cashDifference) : null,
                notes: s.notes,
                closedByUserId: s.closedByUserId,
                status: s.status,
                salesCount: s._count.storeSales,
                createdAt: s.createdAt.toISOString(),
            })),
            meta: { shiftSchedule: SHIFT_SCHEDULE },
        });
    } catch (error) {
        console.error("GET /api/mobile/toko/shifts error:", error);
        return NextResponse.json({ message: "Failed to fetch shifts" }, { status: 500 });
    }
}

// POST /api/mobile/toko/shifts — Buka shift baru
export async function POST(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        const body = await request.json();
        const { shiftName, openingCash, unitType } = body;

        if (!shiftName || !unitType) {
            return NextResponse.json({ message: "shiftName dan unitType wajib diisi" }, { status: 400 });
        }

        const userId = Number(user.id);

        // Cek apakah user sudah punya shift yang masih open
        const existingOpenShift = await prisma.cashierShift.findFirst({
            where: { userId, status: "open" },
        });

        if (existingOpenShift) {
            return NextResponse.json({
                message: `Anda masih memiliki shift "${existingOpenShift.shiftName}" yang belum ditutup. Tutup shift sebelumnya terlebih dahulu.`,
                data: { existingShiftId: existingOpenShift.id },
            }, { status: 400 });
        }

        const shift = await prisma.cashierShift.create({
            data: {
                userId,
                unitType,
                shiftName,
                startedAt: new Date(),
                openingCash: openingCash || 0,
                status: "open",
            },
            include: {
                user: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({
            message: `Shift "${shiftName}" berhasil dibuka.`,
            data: {
                id: shift.id,
                shiftName: shift.shiftName,
                startedAt: shift.startedAt.toISOString(),
                openingCash: Number(shift.openingCash),
                userName: shift.user.name,
                status: shift.status,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/mobile/toko/shifts error:", error);
        return NextResponse.json({ message: "Failed to open shift" }, { status: 500 });
    }
}
