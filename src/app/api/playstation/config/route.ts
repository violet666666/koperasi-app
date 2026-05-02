import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface PSConsoleEntry {
    id: string;
    label: string;
    type: "PS5" | "PS4" | "PS3";
}

interface PSConsoleConfig {
    consoles: PSConsoleEntry[];
    ratePerBlock: number;
    blockDurationMins: number;
    rateByType?: Record<string, number>;
}

const DEFAULT_CONFIG: PSConsoleConfig = {
    consoles: Array.from({ length: 8 }, (_, i) => ({
        id: `TV-${i + 1}`,
        label: `TV ${i + 1} (PS5)`,
        type: "PS5" as const,
    })),
    ratePerBlock: 3750,
    blockDurationMins: 15,
};

const CONFIG_KEY = "playstation_console_config";

export async function GET() {
    try {
        const setting = await prisma.appSetting.findUnique({ where: { key: CONFIG_KEY } });
        if (!setting) return NextResponse.json({ data: DEFAULT_CONFIG });
        const config = JSON.parse(setting.value) as PSConsoleConfig;
        return NextResponse.json({ data: config });
    } catch (error) {
        console.error("[PS_CONFIG_GET]", error);
        return NextResponse.json({ data: DEFAULT_CONFIG });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const user = session.user as any;
        const role = typeof user.role === "string" ? user.role : user.role?.name || "";
        if (!["admin", "operator", "super_admin"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const { consoles, ratePerBlock, blockDurationMins, rateByType } = body as PSConsoleConfig;

        if (!Array.isArray(consoles) || consoles.length === 0) {
            return NextResponse.json({ message: "Minimal 1 console" }, { status: 400 });
        }
        if (!ratePerBlock || ratePerBlock <= 0) {
            return NextResponse.json({ message: "Tarif per blok harus > 0" }, { status: 400 });
        }
        if (!blockDurationMins || blockDurationMins < 1) {
            return NextResponse.json({ message: "Durasi blok harus > 0" }, { status: 400 });
        }

        for (const c of consoles) {
            if (!c.id || !c.label || !["PS5", "PS4", "PS3"].includes(c.type)) {
                return NextResponse.json({ message: `Console ${c.id || "unknown"} tidak valid` }, { status: 400 });
            }
        }

        const config: PSConsoleConfig = {
            consoles: consoles.map(c => ({ id: c.id, label: c.label, type: c.type })),
            ratePerBlock: Number(ratePerBlock),
            blockDurationMins: Number(blockDurationMins),
            ...(rateByType && { rateByType }),
        };

        await prisma.$transaction(async (tx) => {
            await tx.appSetting.upsert({
                where: { key: CONFIG_KEY },
                update: { value: JSON.stringify(config) },
                create: { key: CONFIG_KEY, value: JSON.stringify(config), label: "PlayStation Console Configuration" },
            });

            const rentalProduct = await tx.storeProduct.findFirst({
                where: { unitType: "playstation", isService: true },
            });
            if (rentalProduct) {
                await tx.storeProduct.update({
                    where: { id: rentalProduct.id },
                    data: { sellPrice: config.ratePerBlock },
                });
            }
        });

        return NextResponse.json({ data: config, message: "Konfigurasi berhasil disimpan" });
    } catch (error) {
        console.error("[PS_CONFIG_PUT]", error);
        return NextResponse.json({ message: "Gagal menyimpan konfigurasi" }, { status: 500 });
    }
}
