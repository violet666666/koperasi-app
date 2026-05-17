import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getDefaultFloorPlan, validateFloorPlan, serializeFloorPlan, deserializeFloorPlan } from "@/lib/floor-plan";

export const dynamic = "force-dynamic";

// GET /api/toko/floor-plan?unitType=resto — Get floor plan config
export async function GET(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(req.url);
        const unitType = searchParams.get("unitType") || "resto";
        const settingKey = `floor_plan_${unitType}`;

        const setting = await prisma.appSetting.findUnique({ where: { key: settingKey } });
        if (!setting?.value) {
            return NextResponse.json({ plan: getDefaultFloorPlan(), isDefault: true });
        }

        const plan = deserializeFloorPlan(setting.value as string);
        return NextResponse.json({ plan, isDefault: false });
    } catch (error) {
        console.error("[FloorPlan] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/toko/floor-plan — Save floor plan config (admin only)
export async function PUT(req: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        if (!["admin", "operator", "super_admin"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const body = await req.json();
        const unitType = body.unitType || "resto";
        const plan = body.plan;

        if (!plan) {
            return NextResponse.json({ message: "plan is required" }, { status: 400 });
        }

        const validation = validateFloorPlan(plan);
        if (!validation.valid) {
            return NextResponse.json({ message: "Invalid floor plan", errors: validation.errors }, { status: 400 });
        }

        const settingKey = `floor_plan_${unitType}`;
        await prisma.appSetting.upsert({
            where: { key: settingKey },
            update: { value: serializeFloorPlan(plan) },
            create: { key: settingKey, value: serializeFloorPlan(plan) },
        });

        return NextResponse.json({ message: "Floor plan saved", plan });
    } catch (error) {
        console.error("[FloorPlan] PUT error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
