import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/members/lookup
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const nrp = searchParams.get("nrp");

        if (!nrp) {
            return NextResponse.json({ message: "NRP is required" }, { status: 400 });
        }

        const member = await prisma.member.findUnique({
            where: { nrp },
            select: {
                id: true,
                memberNo: true,
                nrp: true,
                name: true,
                email: true,
                phone: true,
                status: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!member) {
            return NextResponse.json(
                { message: `Anggota dengan NRP ${nrp} tidak ditemukan` },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: member });
    } catch (error) {
        console.error("GET /api/members/lookup error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member" },
            { status: 500 }
        );
    }
}
