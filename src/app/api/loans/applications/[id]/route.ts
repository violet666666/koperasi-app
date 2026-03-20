import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
    params: Promise<{ id: string }>;
}

export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const application = await prisma.loanApplication.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: true,
                product: true,
                branch: true,
                loan: true
            }
        });

        if (!application) return NextResponse.json({ message: "Not found" }, { status: 404 });

        return NextResponse.json({ data: application });
    } catch (error) {
        console.error("GET application error:", error);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
