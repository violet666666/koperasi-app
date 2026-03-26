import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/aset/[id]
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const asset = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
        });

        if (!asset || asset.deletedAt) {
            return NextResponse.json(
                { message: "Aset tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: asset });
    } catch (error) {
        console.error("GET /api/aset/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil data aset" },
            { status: 500 }
        );
    }
}

// PUT /api/aset/[id]
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.asset.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing || existing.deletedAt) {
            return NextResponse.json(
                { message: "Aset tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check duplicate code if changed
        if (body.code && body.code !== existing.code) {
            const dup = await prisma.asset.findUnique({ where: { code: body.code } });
            if (dup) {
                return NextResponse.json(
                    { message: `Kode aset '${body.code}' sudah digunakan` },
                    { status: 400 }
                );
            }
        }

        const cost = body.acquisitionCost ? parseFloat(body.acquisitionCost) : Number(existing.acquisitionCost);
        const accDep = body.accumulatedDepreciation !== undefined
            ? parseFloat(body.accumulatedDepreciation)
            : Number(existing.accumulatedDepreciation);
        const bookValue = cost - accDep;

        const asset = await prisma.asset.update({
            where: { id: parseInt(id) },
            data: {
                code: body.code || existing.code,
                name: body.name || existing.name,
                category: body.category || existing.category,
                acquisitionDate: body.acquisitionDate ? new Date(body.acquisitionDate) : existing.acquisitionDate,
                acquisitionCost: cost,
                usefulLifeYears: body.usefulLifeYears ? parseInt(body.usefulLifeYears) : existing.usefulLifeYears,
                residualValue: body.residualValue !== undefined ? parseFloat(body.residualValue) : existing.residualValue,
                accumulatedDepreciation: accDep,
                bookValue,
                location: body.location !== undefined ? body.location : existing.location,
                description: body.description !== undefined ? body.description : existing.description,
                status: body.status || existing.status,
                disposedDate: body.disposedDate ? new Date(body.disposedDate) : existing.disposedDate,
                disposedValue: body.disposedValue !== undefined ? parseFloat(body.disposedValue) : existing.disposedValue,
            },
        });

        return NextResponse.json({ data: asset });
    } catch (error) {
        console.error("PUT /api/aset/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal mengupdate aset" },
            { status: 500 }
        );
    }
}

// DELETE /api/aset/[id] (soft delete)
export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        await prisma.asset.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Aset berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/aset/[id] error:", error);
        return NextResponse.json(
            { message: "Gagal menghapus aset" },
            { status: 500 }
        );
    }
}
