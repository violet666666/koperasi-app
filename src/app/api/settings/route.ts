import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// Default settings — auto-seeded if not exist in DB
const DEFAULT_SETTINGS: Record<string, { value: string; label: string }> = {
    toko_markup_percent: { value: "2", label: "Markup Harga Jual Toko (%)" },
    toko_ppn_percent: { value: "0", label: "PPN Toko (%)" },
    resto_markup_percent: { value: "2", label: "Markup Harga Jual Resto (%)" },
    resto_ppn_percent: { value: "0", label: "PPN Resto (%)" },
};

/**
 * GET /api/settings?unitType=toko
 * Returns all settings, optionally filtered by unitType prefix
 */
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const unitType = searchParams.get("unitType");

        // Auto-seed defaults if table is empty
        const count = await prisma.appSetting.count();
        if (count === 0) {
            await prisma.appSetting.createMany({
                data: Object.entries(DEFAULT_SETTINGS).map(([key, v]) => ({
                    key,
                    value: v.value,
                    label: v.label,
                })),
                skipDuplicates: true,
            });
        }

        const where = unitType
            ? { key: { startsWith: `${unitType}_` } }
            : {};

        const settings = await prisma.appSetting.findMany({ where, orderBy: { key: "asc" } });

        // Convert to convenient key-value map
        const settingsMap: Record<string, string> = {};
        for (const s of settings) {
            settingsMap[s.key] = s.value;
        }

        return NextResponse.json({ data: settings, map: settingsMap });
    } catch (error) {
        console.error("GET /api/settings error:", error);
        return NextResponse.json({ message: "Gagal mengambil pengaturan" }, { status: 500 });
    }
}

/**
 * PUT /api/settings
 * Body: { settings: [{ key: "toko_markup_percent", value: "2" }, ...] }
 * Only operator/admin can update
 */
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan mengubah pengaturan" }, { status: 403 });
        }

        const body = await request.json();
        const { settings } = body as { settings: { key: string; value: string }[] };

        if (!settings || !Array.isArray(settings)) {
            return NextResponse.json({ message: "Format tidak valid" }, { status: 400 });
        }

        // Validate numeric values
        for (const s of settings) {
            const num = parseFloat(s.value);
            if (isNaN(num) || num < 0 || num > 100) {
                return NextResponse.json({ message: `Nilai "${s.key}" harus antara 0-100` }, { status: 400 });
            }
        }

        // Upsert each setting
        const results = await Promise.all(
            settings.map(s =>
                prisma.appSetting.upsert({
                    where: { key: s.key },
                    update: { value: s.value },
                    create: {
                        key: s.key,
                        value: s.value,
                        label: DEFAULT_SETTINGS[s.key]?.label || s.key,
                    },
                })
            )
        );

        return NextResponse.json({
            message: `${results.length} pengaturan berhasil disimpan`,
            data: results,
        });
    } catch (error) {
        console.error("PUT /api/settings error:", error);
        return NextResponse.json({ message: "Gagal menyimpan pengaturan" }, { status: 500 });
    }
}
