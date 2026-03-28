import { NextResponse } from "next/server";
import { verifyMobileToken, MobileJWTPayload } from "@/lib/jwt";

/**
 * Middleware helper untuk memverifikasi JWT Token dari header Authorization.
 * Digunakan oleh semua endpoint /api/mobile/* 
 */
export function getMobileUser(request: Request): MobileJWTPayload | null {
    const authHeader = request.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return null;
    }
    const token = authHeader.substring(7);
    return verifyMobileToken(token);
}

export function unauthorizedResponse() {
    return NextResponse.json(
        { message: "Token tidak valid atau sudah kadaluwarsa. Silakan login ulang." },
        { status: 401 }
    );
}
