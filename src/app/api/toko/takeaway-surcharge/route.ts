import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

const SETTING_KEY = "takeaway_surcharge_resto";
const DEFAULT_CONFIG = { enabled: true, amountPerItem: 1000 };

// GET /api/toko/takeaway-surcharge — Read surcharge config
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        const unitType = (session.user as any).unitType as string | null;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }
        // Only resto admins/operators can access
        if (role !== "operator" && !isSameUnit(unitType, "resto")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY } });
        const config = setting ? JSON.parse(setting.value) : DEFAULT_CONFIG;
        return NextResponse.json({ data: config });
    } catch (error) {
        console.error("[TakeawaySurcharge] GET error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}

// PUT /api/toko/takeaway-surcharge — Update surcharge config
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = session.user.role as string;
        const unitType = (session.user as any).unitType as string | null;
        if (!["admin", "operator"].includes(role)) {
            return NextResponse.json({ message: "Forbidden — hanya admin/operator" }, { status: 403 });
        }
        if (role !== "operator" && !isSameUnit(unitType, "resto")) {
            return NextResponse.json({ message: "Forbidden — bukan admin Resto" }, { status: 403 });
        }

        const body = await request.json();
        const enabled = Boolean(body.enabled);
        const amountPerItem = Number(body.amountPerItem);

        if (isNaN(amountPerItem) || amountPerItem < 0 || !Number.isInteger(amountPerItem)) {
            return NextResponse.json({ message: "Nominal per item harus bilangan bulat >= 0" }, { status: 400 });
        }

        const config = { enabled, amountPerItem };
        await prisma.appSetting.upsert({
            where: { key: SETTING_KEY },
            update: { value: JSON.stringify(config) },
            create: { key: SETTING_KEY, value: JSON.stringify(config), label: "Biaya Takeaway Resto" },
        });

        return NextResponse.json({ data: config });
    } catch (error) {
        console.error("[TakeawaySurcharge] PUT error:", error);
        return NextResponse.json({ message: "Internal server error" }, { status: 500 });
    }
}
