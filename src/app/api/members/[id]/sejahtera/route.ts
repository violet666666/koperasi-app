import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const session = await auth();
        if (!session) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const memberId = parseInt(params.id);
        if (isNaN(memberId)) {
            return NextResponse.json({ message: "Invalid member ID" }, { status: 400 });
        }

        const url = new URL(request.url);
        const year = url.searchParams.get("year");

        const history = await prisma.tabunganSejahteraHistory.findMany({
            where: {
                memberId: memberId,
                ...(year ? { tahun: parseInt(year) } : {})
            },
            orderBy: [
                { tahun: 'desc' },
                { bulan: 'asc' }
            ]
        });

        return NextResponse.json({ data: history });
    } catch (error) {
        console.error("GET /api/members/[id]/sejahtera error:", error);
        return NextResponse.json(
            { message: "Failed to fetch tabungan sejahtera" },
            { status: 500 }
        );
    }
}
