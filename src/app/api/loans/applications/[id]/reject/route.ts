import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// POST /api/loans/applications/[id]/reject
export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { id } = await params;
        const body = await request.json();
        const { reason } = body;

        if (!reason) {
            return NextResponse.json(
                { message: "Alasan penolakan wajib diisi" },
                { status: 400 }
            );
        }

        const application = await prisma.loanApplication.findUnique({
            where: { id: parseInt(id) },
        });

        if (!application) {
            return NextResponse.json(
                { message: "Pengajuan tidak ditemukan" },
                { status: 404 }
            );
        }

        if (application.status !== "submitted") {
            return NextResponse.json(
                { message: "Pengajuan tidak dalam status menunggu approval" },
                { status: 400 }
            );
        }

        const updated = await prisma.loanApplication.update({
            where: { id: parseInt(id) },
            data: {
                status: "rejected",
                rejectedAt: new Date(),
                rejectedById: parseInt(session.user.id),
                rejectionReason: reason,
            },
        });

        return NextResponse.json({
            data: updated,
            message: "Pengajuan ditolak",
        });
    } catch (error) {
        console.error("POST /api/loans/applications/[id]/reject error:", error);
        return NextResponse.json(
            { message: "Failed to reject application" },
            { status: 500 }
        );
    }
}
