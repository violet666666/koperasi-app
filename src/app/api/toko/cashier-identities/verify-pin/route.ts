import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

// Simple in-memory rate limiter: { identityId → { attempts, lockedUntil } }
const rateLimiter = new Map<number, { attempts: number; lockedUntil: number }>();

// POST /api/toko/cashier-identities/verify-pin
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userId = parseInt(session.user.id);
        const { identityId, pin } = await request.json();

        if (!identityId || !pin) {
            return NextResponse.json({ message: "identityId dan PIN wajib diisi" }, { status: 400 });
        }

        const identity = await prisma.cashierIdentity.findUnique({
            where: { id: identityId },
        });

        if (!identity || !identity.isActive) {
            return NextResponse.json({ message: "Identitas kasir tidak ditemukan" }, { status: 404 });
        }

        // Verify this identity belongs to the logged-in user
        if (identity.parentUserId !== userId) {
            return NextResponse.json({ message: "Identitas tidak sesuai dengan akun Anda" }, { status: 403 });
        }

        // Rate limit check
        const limiter = rateLimiter.get(identityId);
        if (limiter && limiter.lockedUntil > Date.now()) {
            const remainingSec = Math.ceil((limiter.lockedUntil - Date.now()) / 1000);
            return NextResponse.json(
                { message: `Akun terkunci. Coba lagi dalam ${remainingSec} detik.` },
                { status: 429 }
            );
        }

        // Verify PIN
        const isValid = await bcrypt.compare(pin, identity.pin);

        if (!isValid) {
            // Increment failed attempts
            const current = rateLimiter.get(identityId) || { attempts: 0, lockedUntil: 0 };
            current.attempts += 1;

            if (current.attempts >= 5) {
                current.lockedUntil = Date.now() + 5 * 60 * 1000; // Lock 5 minutes
                current.attempts = 0;
            }

            rateLimiter.set(identityId, current);

            return NextResponse.json({ message: "PIN salah" }, { status: 401 });
        }

        // Success — reset rate limiter
        rateLimiter.delete(identityId);

        return NextResponse.json({
            data: {
                id: identity.id,
                username: identity.username,
                displayName: identity.displayName,
            },
        });
    } catch (error) {
        console.error("POST /api/toko/cashier-identities/verify-pin error:", error);
        return NextResponse.json({ message: "Gagal verifikasi PIN" }, { status: 500 });
    }
}
