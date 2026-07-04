import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    // Role gate only — Asset model has no branchId/unitType field (deviation: no scope filter).
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const asset = await prisma.asset.findUnique({
            where: { id },
        });

        if (!asset) {
            return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
        }

        // Convert decimals for mobile
        const data = {
            ...asset,
            acquisitionCost: Number(asset.acquisitionCost),
            accumulatedDepreciation: Number(asset.accumulatedDepreciation),
            residualValue: Number(asset.residualValue),
            bookValue: Number(asset.bookValue),
            disposedValue: asset.disposedValue ? Number(asset.disposedValue) : null,
        };

        // Simulasikan penyusutan bulanan (Garis Lurus)
        const months = data.usefulLifeYears * 12;
        const straightLineDepreciationPerMonth = months > 0 
           ? (data.acquisitionCost - data.residualValue) / months 
           : 0;

        return NextResponse.json({
            data: {
                ...data,
                straightLineDepreciationPerMonth,
            }
        });
    } catch (error) {
        console.error("GET /api/mobile/assets/[id] error:", error);
        return NextResponse.json({ message: "Gagal memuat detail aset" }, { status: 500 });
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

        // Duplicate-code check only if code is being changed
        if (body.code && body.code !== existing.code) {
            const dup = await prisma.asset.findUnique({ where: { code: body.code } });
            if (dup) {
                return NextResponse.json(
                    { message: `Kode aset '${body.code}' sudah digunakan` },
                    { status: 400 }
                );
            }
        }

        // Recompute bookValue = acquisitionCost - accumulatedDepreciation
        const cost =
            body.acquisitionCost !== undefined
                ? Number(body.acquisitionCost)
                : Number(existing.acquisitionCost);
        const accDep =
            body.accumulatedDepreciation !== undefined
                ? Number(body.accumulatedDepreciation)
                : Number(existing.accumulatedDepreciation);
        const bookValue = cost - accDep;

        const updated = await prisma.asset.update({
            where: { id },
            data: {
                code: body.code ?? existing.code,
                name: body.name ?? existing.name,
                category: body.category ?? existing.category,
                acquisitionDate: body.acquisitionDate
                    ? new Date(body.acquisitionDate)
                    : existing.acquisitionDate,
                acquisitionCost: cost,
                usefulLifeYears:
                    body.usefulLifeYears !== undefined
                        ? parseInt(body.usefulLifeYears)
                        : existing.usefulLifeYears,
                residualValue:
                    body.residualValue !== undefined
                        ? Number(body.residualValue)
                        : existing.residualValue,
                accumulatedDepreciation: accDep,
                bookValue,
                location: body.location !== undefined ? body.location : existing.location,
                description:
                    body.description !== undefined ? body.description : existing.description,
            },
        });

        await prisma.auditLog.create({
            data: {
                action: "UPDATE",
                module: "Aset",
                description: `Edit Aset dari Mobile: ${updated.code} - ${updated.name}`,
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
        console.error("PUT /api/mobile/assets/[id] error:", error);
        return NextResponse.json({ message: "Gagal mengupdate aset" }, { status: 500 });
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { id: idStr } = await params;
        const id = parseInt(idStr);
        if (isNaN(id)) return NextResponse.json({ message: "ID tidak valid" }, { status: 400 });

        const existing = await prisma.asset.findUnique({ where: { id } });
        if (!existing || existing.deletedAt) {
            return NextResponse.json({ message: "Aset tidak ditemukan" }, { status: 404 });
        }

        // Soft delete — set deletedAt, do not physically remove the row
        await prisma.asset.update({ where: { id }, data: { deletedAt: new Date() } });

        await prisma.auditLog.create({
            data: {
                action: "DELETE",
                module: "Aset",
                description: `Hapus (soft) Aset dari Mobile: ${existing.code} - ${existing.name}`,
                userId: Number(user.id),
                userName: user.name,
                userRole: user.role,
                status: "success",
            },
        });

        return NextResponse.json({ message: "Aset berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/mobile/assets/[id] error:", error);
        return NextResponse.json({ message: "Gagal menghapus aset" }, { status: 500 });
    }
}
