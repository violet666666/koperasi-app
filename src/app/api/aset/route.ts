import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// GET /api/aset - List all assets
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const category = searchParams.get("category") || "";
        const status = searchParams.get("status") || "";

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
            ];
        }
        if (category) where.category = category;
        if (status) where.status = status;

        const assets = await prisma.asset.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        return NextResponse.json({ data: assets });
    } catch (error) {
        console.error("GET /api/aset error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil data aset" },
            { status: 500 }
        );
    }
}

// POST /api/aset - Create a new asset
export async function POST(request: Request) {
    try {
        const body = await request.json();

        const {
            code, name, category, acquisitionDate, acquisitionCost,
            usefulLifeYears, residualValue, location, description, status,
        } = body;

        if (!code || !name || !category || !acquisitionDate || !acquisitionCost || !usefulLifeYears) {
            return NextResponse.json(
                { message: "Kode, Nama, Kategori, Tanggal Perolehan, Harga Perolehan, dan Umur Manfaat wajib diisi" },
                { status: 400 }
            );
        }

        // Check duplicate code
        const existing = await prisma.asset.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json(
                { message: `Kode aset '${code}' sudah digunakan` },
                { status: 400 }
            );
        }

        const cost = parseFloat(acquisitionCost);
        const residual = parseFloat(residualValue || "0");
        const bookValue = cost - 0; // New asset starts with full book value

        const asset = await prisma.asset.create({
            data: {
                code,
                name,
                category,
                acquisitionDate: new Date(acquisitionDate),
                acquisitionCost: cost,
                usefulLifeYears: parseInt(usefulLifeYears),
                residualValue: residual,
                accumulatedDepreciation: 0,
                bookValue: cost,
                location: location || null,
                description: description || null,
                status: status || "active",
            },
        });

        // Audit log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Aset",
                description: `Aset baru: ${asset.code} - ${asset.name} (${category})`,
                targetId: String(asset.id), targetType: "Asset",
                newData: { id: asset.id, code: asset.code, name: asset.name, acquisitionCost: cost },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({ data: asset }, { status: 201 });
    } catch (error) {
        console.error("POST /api/aset error:", error);
        return NextResponse.json(
            { message: "Gagal membuat aset baru" },
            { status: 500 }
        );
    }
}
