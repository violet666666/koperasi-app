import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/members/lookup?q=xxx — Fuzzy search for members by NRP, name, or memberNo
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q") || searchParams.get("nrp") || "";

        if (!q || q.trim().length < 1) {
            return NextResponse.json({ message: "Parameter pencarian (q) diperlukan", data: [] }, { status: 400 });
        }

        const searchTerm = q.trim();

        const members = await prisma.member.findMany({
            where: {
                status: "active",
                deletedAt: null,
                OR: [
                    { nrp: { contains: searchTerm, mode: "insensitive" } },
                    { memberNo: { contains: searchTerm, mode: "insensitive" } },
                    { name: { contains: searchTerm, mode: "insensitive" } },
                ],
            },
            select: {
                id: true,
                memberNo: true,
                nrp: true,
                name: true,
                email: true,
                phone: true,
                category: true,
                status: true,
                branch: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
            orderBy: { name: "asc" },
            take: 20,
        });

        return NextResponse.json({ data: members });
    } catch (error) {
        console.error("GET /api/members/lookup error:", error);
        return NextResponse.json(
            { message: "Failed to fetch member" },
            { status: 500 }
        );
    }
}
