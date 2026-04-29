import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/toko/cashier-session — Get current cashier identity
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const cookieStore = await cookies();
        const identityId = cookieStore.get("cashier_identity_id")?.value;

        if (!identityId) {
            return NextResponse.json({ data: null });
        }

        const identity = await prisma.cashierIdentity.findUnique({
            where: { id: parseInt(identityId) },
            select: { id: true, username: true, displayName: true, isActive: true },
        });

        if (!identity || !identity.isActive) {
            const response = NextResponse.json({ data: null });
            response.cookies.delete("cashier_identity_id");
            return response;
        }

        return NextResponse.json({
            data: {
                id: identity.id,
                username: identity.username,
                displayName: identity.displayName,
            },
        });
    } catch (error) {
        console.error("GET /api/toko/cashier-session error:", error);
        return NextResponse.json({ message: "Gagal mengambil sesi kasir" }, { status: 500 });
    }
}

// POST /api/toko/cashier-session — Set active cashier identity
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { identityId } = await request.json();
        if (!identityId) {
            return NextResponse.json({ message: "identityId wajib diisi" }, { status: 400 });
        }

        const userId = parseInt(session.user.id);

        // Verify identity belongs to this user
        const identity = await prisma.cashierIdentity.findFirst({
            where: { id: identityId, parentUserId: userId, isActive: true },
        });

        if (!identity) {
            return NextResponse.json({ message: "Identitas tidak valid" }, { status: 403 });
        }

        const response = NextResponse.json({
            data: { id: identity.id, username: identity.username, displayName: identity.displayName },
        });

        response.cookies.set("cashier_identity_id", String(identityId), {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: 60 * 60 * 24,
        });

        return response;
    } catch (error) {
        console.error("POST /api/toko/cashier-session error:", error);
        return NextResponse.json({ message: "Gagal mengatur sesi kasir" }, { status: 500 });
    }
}

// DELETE /api/toko/cashier-session — Clear active cashier identity
export async function DELETE() {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const response = NextResponse.json({ message: "Sesi kasir berhasil dihapus" });
        response.cookies.delete("cashier_identity_id");
        return response;
    } catch (error) {
        console.error("DELETE /api/toko/cashier-session error:", error);
        return NextResponse.json({ message: "Gagal menghapus sesi" }, { status: 500 });
    }
}
