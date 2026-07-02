import { NextResponse } from "next/server";
import { verifyMobileToken, MobileJWTPayload } from "@/lib/jwt";
import prisma from "@/lib/prisma";

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

/**
 * Verify JWT and load fresh scope fields (branchId/unitType/memberId) from DB.
 * The mobile JWT lacks these, so a single user.findUnique is required for scope checks.
 * Returns null if the token is invalid or the user no longer exists.
 */
export async function getMobileUserWithScope(request: Request) {
  const mobileUser = getMobileUser(request);
  if (!mobileUser) return null;
  const dbUser = await prisma.user.findUnique({
    where: { id: Number(mobileUser.id) },
    select: { id: true, branchId: true, unitType: true, memberId: true },
  });
  if (!dbUser) return null;
  return {
    ...mobileUser,
    branchId: dbUser.branchId, // fresh DB value overrides any stale JWT field
    unitType: dbUser.unitType,
    memberId: dbUser.memberId ?? null,
  };
}
