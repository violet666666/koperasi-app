import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// POST /api/loans/applications/[id]/approve
export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const allowedRoles = ["operator"];
        if (!allowedRoles.includes(session.user.role)) {
            return NextResponse.json({ message: "Tidak ada izin menyetujui pengajuan" }, { status: 403 });
        }
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
                approvedById: parseInt(session.user.id),
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
