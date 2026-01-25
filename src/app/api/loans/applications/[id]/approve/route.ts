import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

interface Params {
    params: Promise<{ id: string }>;
}

// POST /api/loans/applications/[id]/approve
export async function POST(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { notes } = body;

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
                status: "approved",
                approvedAt: new Date(),
                approvedById: 1, // TODO: Get from session
                notes: notes || application.notes,
            },
        });

        return NextResponse.json({
            data: updated,
            message: "Pengajuan berhasil disetujui",
        });
    } catch (error) {
        console.error("POST /api/loans/applications/[id]/approve error:", error);
        return NextResponse.json(
            { message: "Failed to approve application" },
            { status: 500 }
        );
    }
}
