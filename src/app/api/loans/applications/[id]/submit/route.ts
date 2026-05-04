import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// POST /api/loans/applications/[id]/submit
export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const application = await prisma.loanApplication.findUnique({
            where: { id: parseInt(id) },
        });

        if (!application) {
            return NextResponse.json(
                { message: "Pengajuan tidak ditemukan" },
                { status: 404 }
            );
        }

        if (application.status !== "draft") {
            return NextResponse.json(
                { message: "Pengajuan sudah disubmit sebelumnya" },
                { status: 400 }
            );
        }

        const updated = await prisma.loanApplication.update({
            where: { id: parseInt(id) },
            data: {
                status: "submitted",
                submittedAt: new Date(),
            },
        });

        return NextResponse.json({
            data: updated,
            message: "Pengajuan berhasil disubmit untuk approval",
        });
    } catch (error) {
        console.error("POST /api/loans/applications/[id]/submit error:", error);
        return NextResponse.json(
            { message: "Failed to submit application" },
            { status: 500 }
        );
    }
}
