import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { slug } = await context.params;
        const unitType = slug.replace(/-/g, '_');

        const packages = await prisma.unitServicePackage.findMany({
            where: { unitType },
            orderBy: { sortOrder: 'asc' }
        });

        return NextResponse.json(packages);
    } catch (error) {
        console.error("GET /api/unit/[slug]/packages error:", error);
        return NextResponse.json({ message: "Gagal mengambil daftar paket layanan" }, { status: 500 });
    }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (!["operator", "admin"].includes(session.user.role)) {
            return NextResponse.json({ message: "Hanya Admin Unit yang dapat menambah paket layanan" }, { status: 403 });
        }

        const { slug } = await context.params;
        const unitType = slug.replace(/-/g, '_');
        const body = await request.json();

        // Admin cannot modify packages of other units unless they are operator
        if (session.user.role === "admin" && !isSameUnit(session.user.unitType, unitType) && session.user.unitType !== null) {
            return NextResponse.json({ message: "Anda tidak berhak memodifikasi paket unit ini" }, { status: 403 });
        }

        const { name, description, price, isActive, sortOrder } = body;

        if (!name || price === undefined) {
            return NextResponse.json({ message: "Nama paket dan harga wajib diisi" }, { status: 400 });
        }

        const newPackage = await prisma.unitServicePackage.create({
            data: {
                unitType,
                name,
                description,
                price: Number(price),
                isActive: isActive !== false,
                sortOrder: Number(sortOrder || 0),
                createdById: parseInt(session.user.id)
            }
        });

        return NextResponse.json(newPackage, { status: 201 });
    } catch (error) {
        console.error("POST /api/unit/[slug]/packages error:", error);
        return NextResponse.json({ message: "Gagal menambahkan paket layanan" }, { status: 500 });
    }
}
