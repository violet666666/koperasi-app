import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    // Role gate only — Asset model has no branchId/unitType field (matches existing asset routes).
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const body = await request.json();
        const existing = await prisma.asset.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
        }

        // Reject if already disposed
        if (existing.status === "disposed") {
            return NextResponse.json(
                { message: "Aset sudah di-dispose" },
                { status: 400 }
            );
        }

        // disposedDate is required
        if (!body.disposedDate) {
            return NextResponse.json(
                { message: "disposedDate wajib diisi" },
                { status: 400 }
            );
        }

        const updated = await prisma.asset.update({
            where: { id },
            data: {
                status: "disposed",
                disposedDate: new Date(body.disposedDate),
                disposedValue:
                    body.disposedValue !== undefined ? Number(body.disposedValue) : null,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "DISPOSE",
                module: "Aset",
                description: `Dispose Aset dari Mobile: ${existing.code} - ${existing.name}`,
                userId: Number(user.id),
                userName: user.name,
                userRole: user.role,
                status: "success",
            },
        });

        const data = {
            ...updated,
            acquisitionCost: Number(updated.acquisitionCost),
            accumulatedDepreciation: Number(updated.accumulatedDepreciation),
            residualValue: Number(updated.residualValue),
            bookValue: Number(updated.bookValue),
            disposedValue: updated.disposedValue ? Number(updated.disposedValue) : null,
        };
        return NextResponse.json({ data });
    } catch (error) {
        console.error("POST /api/mobile/assets/[id]/dispose error:", error);
        return NextResponse.json({ message: "Gagal dispose aset" }, { status: 500 });
    }
}
