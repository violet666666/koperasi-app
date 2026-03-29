import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const category = searchParams.get("category") || "";

        const where: any = { deletedAt: null };
        if (search) {
            where.OR = [
                { name: { contains: search, mode: "insensitive" } },
                { code: { contains: search, mode: "insensitive" } },
            ];
        }
        if (category) where.category = category;

        const assetsRaw = await prisma.asset.findMany({
            where,
            orderBy: { createdAt: "desc" },
        });

        // Convert Decimal to String/Number for mobile parsing
        const data = assetsRaw.map((a) => ({
            ...a,
            acquisitionCost: Number(a.acquisitionCost),
            accumulatedDepreciation: Number(a.accumulatedDepreciation),
            residualValue: Number(a.residualValue),
            bookValue: Number(a.bookValue),
            disposedValue: a.disposedValue ? Number(a.disposedValue) : null,
        }));

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/mobile/assets error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data aset" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "superadmin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { code, name, category, acquisitionDate, acquisitionCost, usefulLifeYears, location, description } = body;

        if (!code || !name || !category || !acquisitionDate || !acquisitionCost || !usefulLifeYears) {
            return NextResponse.json({ message: "Data aset tidak lengkap" }, { status: 400 });
        }

        const existing = await prisma.asset.findUnique({ where: { code } });
        if (existing) {
            return NextResponse.json({ message: `Kode aset '${code}' sudah digunakan` }, { status: 400 });
        }

        const cost = typeof acquisitionCost === "number" ? acquisitionCost : parseFloat(acquisitionCost);
        
        const asset = await prisma.$transaction(async (tx) => {
            const newAset = await tx.asset.create({
                data: {
                    code,
                    name,
                    category,
                    acquisitionDate: new Date(acquisitionDate),
                    acquisitionCost: cost,
                    usefulLifeYears: parseInt(usefulLifeYears),
                    residualValue: 0,
                    accumulatedDepreciation: 0,
                    bookValue: cost,
                    location: location || null,
                    description: description || null,
                    status: "active",
                },
            });

            await tx.auditLog.create({
                data: {
                    action: "CREATE",
                    module: "Aset",
                    description: `Menambah Aset dari Mobile: ${code} - ${name} (${category})`,
                    userId: Number(user.id),
                    userName: user.name,
                    userRole: user.role,
                    status: "success",
                },
            });

            return newAset;
        });

        return NextResponse.json({ message: "Berhasil menyimpan aset", data: asset }, { status: 201 });
    } catch (error) {
        console.error("POST /api/mobile/assets error:", error);
        return NextResponse.json({ message: "Gagal internal server", error }, { status: 500 });
    }
}
