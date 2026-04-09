import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const setting = await prisma.systemSetting.findUnique({
            where: { id: "global" }
        });

        return NextResponse.json({ data: setting?.shuConfig || null });
    } catch (error) {
        console.error("GET /api/settings/shu error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        
        const setting = await prisma.systemSetting.upsert({
            where: { id: "global" },
            update: {
                shuConfig: body,
                updatedById: Number(session.user.id)
            },
            create: {
                id: "global",
                shuConfig: body,
                updatedById: Number(session.user.id)
            }
        });

        return NextResponse.json({ 
             message: "Konfigurasi SHU berhasil disimpan", 
             data: setting.shuConfig 
        });

    } catch (error) {
        console.error("POST /api/settings/shu error:", error);
        return NextResponse.json({ error: "Gagal menyimpan konfigurasi" }, { status: 500 });
    }
}
