import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { getShiftSchedule } from "@/lib/shift-schedule";

// GET /api/toko/shifts — List shifts
// Kasir: hanya shift milik sendiri
// Admin Toko / Operator: semua shift di unit mereka
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get("status"); // "open" | "closed" | null (all)
        const userId = searchParams.get("userId");
        const unitType = searchParams.get("unitType");
        const dateFrom = searchParams.get("dateFrom");
        const dateTo = searchParams.get("dateTo");
        const limit = parseInt(searchParams.get("limit") || "50");

        const sessionUser = await prisma.user.findUnique({
            where: { id: Number(session.user.id) },
            include: { role: true },
        });

        if (!sessionUser) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const isOperator = sessionUser.role.name === "operator";
        const isAdmin = sessionUser.role.name === "admin";
        const isKasir = sessionUser.role.name === "kasir";

        // Build where clause
        const where: any = {};

        if (status) where.status = status;
        if (unitType) where.unitType = unitType;

        // Kasir hanya bisa lihat shift sendiri
        if (isKasir) {
            where.userId = sessionUser.id;
        } else if (isAdmin) {
            // Admin hanya lihat shift di unit-nya
            where.unitType = sessionUser.unitType || unitType;
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
                cashierIdentity: { select: { id: true, displayName: true } },
                _count: { select: { storeSales: true } },
            },
            orderBy: { startedAt: "desc" },
            take: limit,
        });

        // For open shifts, compute live stats from StoreSale
        const shiftResults = await Promise.all(shifts.map(async (s: any) => {
            let liveCash = Number(s.totalSalesCash);
            let liveQris = Number(s.totalSalesQris);
            let liveCredit = Number(s.totalSalesCredit);
            let liveTxCount = s.totalTransactions;

            if (s.status === "open") {
                const activeSales = await prisma.storeSale.findMany({
                    where: { shiftId: s.id },
                    select: { paymentMethod: true, totalAmount: true, metadata: true },
                });
                const valid = activeSales.filter((sale: any) => {
                    if (!sale.metadata) return true;
                    const meta = typeof sale.metadata === "object" ? sale.metadata : JSON.parse(sale.metadata as string);
                    return !meta.isVoided;
                });
                liveCash = 0; liveQris = 0; liveCredit = 0; liveTxCount = 0;
                for (const sale of valid) {
                    liveTxCount++;
                    const amt = Number(sale.totalAmount || 0);
                    if (sale.paymentMethod === "cash") liveCash += amt;
                    else if (sale.paymentMethod === "qris") liveQris += amt;
                    else if (sale.paymentMethod === "salary_cut") liveCredit += amt;
                }
            }

            return {
                id: s.id,
                userId: s.userId,
                userName: s.user.name,
                cashierDisplayName: s.cashierIdentity?.displayName || null,
                unitType: s.unitType,
                shiftName: s.shiftName,
                startedAt: s.startedAt.toISOString(),
                endedAt: s.endedAt?.toISOString() || null,
                openingCash: Number(s.openingCash),
                closingCash: s.closingCash ? Number(s.closingCash) : null,
                expectedCash: s.expectedCash ? Number(s.expectedCash) : null,
                totalSalesCash: liveCash,
                totalSalesQris: liveQris,
                totalSalesCredit: liveCredit,
                totalTransactions: liveTxCount,
                cashDifference: s.cashDifference ? Number(s.cashDifference) : null,
                notes: s.notes,
                closedByUserId: s.closedByUserId,
                status: s.status,
                salesCount: s._count.storeSales,
                createdAt: s.createdAt.toISOString(),
            };
        }));

        return NextResponse.json({
            data: shiftResults,
            meta: { shiftSchedule: await getShiftSchedule(unitType || undefined) },
        });
    } catch (error) {
        console.error("GET /api/toko/shifts error:", error);
        return NextResponse.json({ message: "Failed to fetch shifts" }, { status: 500 });
    }
}

// POST /api/toko/shifts — Buka shift baru
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { shiftName, openingCash, unitType, cashierIdentityId } = body;

        if (!shiftName || !unitType) {
            return NextResponse.json({ message: "shiftName dan unitType wajib diisi" }, { status: 400 });
        }

        // Validate shiftName against configured schedule
        const schedule = await getShiftSchedule(unitType);
        if (!schedule.some(s => s.name === shiftName)) {
            return NextResponse.json({ message: `Shift "${shiftName}" tidak valid` }, { status: 400 });
        }

        const userId = Number(session.user.id);

        // Resolve cashierIdentityId: explicit param > cookie > null
        let resolvedIdentityId: number | null = cashierIdentityId ? Number(cashierIdentityId) : null;
        if (!resolvedIdentityId) {
            try {
                const cookieStore = await cookies();
                const cookieVal = cookieStore.get("cashier_identity_id")?.value;
                if (cookieVal) resolvedIdentityId = parseInt(cookieVal);
            } catch { /* non-critical */ }
        }

        // Cek apakah user sudah punya shift yang masih open di unit yang sama
        const existingOpenShift = await prisma.cashierShift.findFirst({
            where: { userId, status: "open", unitType },
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
                cashierIdentityId: resolvedIdentityId,
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
        console.error("POST /api/toko/shifts error:", error);
        return NextResponse.json({ message: "Failed to open shift" }, { status: 500 });
    }
}
