import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";
import { isSameUnit } from "@/lib/unit-aliases";

const ALLOWED_ROLES = ["admin", "operator"];

// GET /api/toko/cashier-identities — List identities for this device user
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const role = session.user.role as string;

        let identities;
        if (ALLOWED_ROLES.includes(role)) {
            // Admin/Operator: see all identities for users in their unit
            // Super_admin: see all identities (no unit filter)
            const unitType = (session.user as any).unitType;
            const whereClause = role === "operator" ? {} : { parentUser: { unitType } };
            identities = await prisma.cashierIdentity.findMany({
                where: whereClause,
                include: { parentUser: { select: { id: true, name: true, email: true } } },
                orderBy: { displayName: "asc" },
            });
        } else if (role === "kasir") {
            // Kasir: only see identities linked to their own account
            identities = await prisma.cashierIdentity.findMany({
                where: { parentUserId: userId, isActive: true },
                orderBy: { displayName: "asc" },
            });
        } else {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        return NextResponse.json({
            data: identities.map((i: any) => ({
                id: i.id,
                username: i.username,
                displayName: i.displayName,
                isActive: i.isActive,
                parentUserId: i.parentUserId,
                parentUserName: i.parentUser?.name || null,
                parentUserEmail: i.parentUser?.email || null,
                createdAt: i.createdAt,
            })),
        });
    } catch (error) {
        console.error("GET /api/toko/cashier-identities error:", error);
        return NextResponse.json({ message: "Failed to fetch cashier identities" }, { status: 500 });
    }
}

// POST /api/toko/cashier-identities — Create identity
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (!ALLOWED_ROLES.includes(role)) {
            return NextResponse.json({ message: "Hanya Admin/Operator yang dapat membuat identitas kasir." }, { status: 403 });
        }

        const body = await request.json();
        const { parentUserId, username, pin, displayName } = body;

        if (!parentUserId || !username || !pin || !displayName) {
            return NextResponse.json({ message: "parentUserId, username, PIN, dan displayName wajib diisi" }, { status: 400 });
        }

        if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
            return NextResponse.json({ message: "Username harus 3-20 karakter alfanumerik" }, { status: 400 });
        }

        if (!/^\d{4,6}$/.test(pin)) {
            return NextResponse.json({ message: "PIN harus 4-6 digit angka" }, { status: 400 });
        }

        if (displayName.length > 50) {
            return NextResponse.json({ message: "Nama tampilan maks 50 karakter" }, { status: 400 });
        }

        // Check duplicate username per parent user
        const existing = await prisma.cashierIdentity.findUnique({
            where: { parentUserId_username: { parentUserId, username } },
        });

        // Verify target user belongs to the same unit (unless super_admin)
        const targetUser = await prisma.user.findUnique({
            where: { id: parentUserId },
            select: { unitType: true },
        });
        if (!targetUser) {
            return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
        }
        const adminUnitType = (session.user as any).unitType;
        if (role !== "operator" && !isSameUnit(targetUser.unitType, adminUnitType)) {
            return NextResponse.json({ message: "User bukan dari unit Anda" }, { status: 403 });
        }

        if (existing) {
            return NextResponse.json({ message: `Username "${username}" sudah digunakan.` }, { status: 409 });
        }

        const hashedPin = await bcrypt.hash(pin, 10);

        const identity = await prisma.cashierIdentity.create({
            data: { parentUserId, username, pin: hashedPin, displayName },
        });

        return NextResponse.json({
            data: { id: identity.id, username: identity.username, displayName: identity.displayName, isActive: identity.isActive },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/toko/cashier-identities error:", error);
        return NextResponse.json({ message: "Gagal membuat identitas kasir" }, { status: 500 });
    }
}
