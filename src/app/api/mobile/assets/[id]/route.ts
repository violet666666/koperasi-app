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
