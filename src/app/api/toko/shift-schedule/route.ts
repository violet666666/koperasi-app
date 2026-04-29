import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getShiftSchedule } from "@/lib/shift-schedule";

// GET /api/toko/shift-schedule?unitType=toko — Get shift schedule
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType") || "toko";
        const schedule = await getShiftSchedule(unitType);
        return NextResponse.json({ data: schedule });
    } catch (error) {
        console.error("GET /api/toko/shift-schedule error:", error);
        return NextResponse.json({ message: "Gagal mengambil jadwal shift" }, { status: 500 });
    }
}

// PUT /api/toko/shift-schedule — Update shift schedule (admin/operator only)
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role !== "admin" && role !== "operator" && role !== "super_admin") {
            return NextResponse.json({ message: "Hanya admin/operator yang dapat mengubah jadwal shift" }, { status: 403 });
        }

        const body = await request.json();
        const { unitType, schedule } = body as {
            unitType: string;
            schedule: { name: string; startHour: number; endHour: number }[];
        };

        if (!unitType || !Array.isArray(schedule) || schedule.length === 0) {
            return NextResponse.json({ message: "unitType dan schedule wajib diisi" }, { status: 400 });
        }

        // Validate each shift entry
        for (const shift of schedule) {
            if (!shift.name || typeof shift.startHour !== "number" || typeof shift.endHour !== "number") {
                return NextResponse.json({ message: "Setiap shift harus memiliki name, startHour, dan endHour" }, { status: 400 });
            }
            if (shift.startHour < 0 || shift.startHour > 23 || shift.endHour < 0 || shift.endHour > 23) {
                return NextResponse.json({ message: `Jam shift "${shift.name}" tidak valid (0-23)` }, { status: 400 });
            }
            if (shift.name.length > 20) {
                return NextResponse.json({ message: `Nama shift "${shift.name}" terlalu panjang (maks 20 karakter)` }, { status: 400 });
            }
        }

        const key = `${unitType}_shift_schedule`;
        await prisma.appSetting.upsert({
            where: { key },
            update: { value: JSON.stringify(schedule), label: `Jadwal Shift (${unitType})` },
            create: { key, value: JSON.stringify(schedule), label: `Jadwal Shift (${unitType})` },
        });

        return NextResponse.json({
            message: "Jadwal shift berhasil diperbarui",
            data: schedule,
        });
    } catch (error) {
        console.error("PUT /api/toko/shift-schedule error:", error);
        return NextResponse.json({ message: "Gagal menyimpan jadwal shift" }, { status: 500 });
    }
}
