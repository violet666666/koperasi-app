import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getQueueDateKey, getDefaultQueueConfig, formatQueueNumber, mergeQueueConfig, validateQueueConfig } from "@/lib/queue";

export const dynamic = "force-dynamic";

const ALLOWED_QUEUE_ROLES = ["admin", "operator", "kasir"];
const ALLOWED_QUEUE_ADMIN_ROLES = ["admin", "operator"];

// GET /api/toko/queue/next — Get current queue count (for display)
// Query params: unitType
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_QUEUE_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(req.url);
        const unitType = searchParams.get("unitType") || "cafe_lsp";
        const today = new Date();
        const dateKey = getQueueDateKey(unitType, today);

        // Load config from AppSetting
        const config = await loadQueueConfig(unitType);
        const counter = await getCounter(dateKey);

        return NextResponse.json({
            config,
            currentCount: counter,
            queueNumber: counter > 0 ? formatQueueNumber(counter, config) : null,
        });
    } catch (error) {
        console.error("[Queue] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// POST /api/toko/queue/next — Atomically get next queue number
export async function POST(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_QUEUE_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const unitType = body.unitType || "cafe_lsp";
        const today = new Date();
        const dateKey = getQueueDateKey(unitType, today);

        // Load config
        const config = await loadQueueConfig(unitType);

        // Check maxPerDay limit
        if (config.maxPerDay > 0) {
            const current = await getCounter(dateKey);
            if (current >= config.maxPerDay) {
                return NextResponse.json(
                    { message: `Queue limit reached (${config.maxPerDay} per day)` },
                    { status: 400 }
                );
            }
        }

        // Atomic increment via $transaction
        const newCount = await incrementCounter(dateKey);
        const queueNumber = formatQueueNumber(newCount, config);

        return NextResponse.json({
            queueNumber,
            count: newCount,
            config,
        }, { status: 201 });
    } catch (error) {
        console.error("[Queue] POST error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/toko/queue/config — Update queue config (admin only)
export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!ALLOWED_QUEUE_ADMIN_ROLES.includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const validation = validateQueueConfig(body.config || {});
        if (!validation.valid) {
            return NextResponse.json({ message: validation.errors.join(", ") }, { status: 400 });
        }
        const unitType = body.unitType || "cafe_lsp";
        const settingKey = `queue_config_${unitType}`;

        await prisma.appSetting.upsert({
            where: { key: settingKey },
            update: { value: JSON.stringify(body.config) },
            create: { key: settingKey, value: JSON.stringify(body.config) },
        });

        return NextResponse.json({ message: "Config updated", config: body.config });
    } catch (error) {
        console.error("[Queue] PUT error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// Helper: load queue config from AppSetting
async function loadQueueConfig(unitType: string) {
    const settingKey = `queue_config_${unitType}`;
    const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
    if (setting?.value) {
        try {
            const parsed = JSON.parse(setting.value as string);
            return mergeQueueConfig(parsed);
        } catch {
            return getDefaultQueueConfig();
        }
    }
    return getDefaultQueueConfig();
}

// Helper: get current counter value
async function getCounter(dateKey: string): Promise<number> {
    const setting = await prisma.appSetting.findUnique({ where: { key: dateKey } });
    if (!setting?.value) return 0;
    return parseInt(setting.value as string, 10) || 0;
}

// Helper: atomic increment using SELECT FOR UPDATE to prevent race conditions
async function incrementCounter(dateKey: string): Promise<number> {
    const result = await prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ value: string }>>`
            SELECT value FROM app_settings WHERE key = ${dateKey} FOR UPDATE
        `;
        if (rows.length > 0) {
            const currentVal = parseInt(rows[0].value, 10) || 0;
            const newVal = currentVal + 1;
            await tx.$executeRaw`UPDATE app_settings SET value = ${String(newVal)}, updated_at = NOW() WHERE key = ${dateKey}`;
            return newVal;
        } else {
            await tx.$executeRaw`INSERT INTO app_settings (key, value, updated_at) VALUES (${dateKey}, '1', NOW())`;
            return 1;
        }
    });
    return result;
}
