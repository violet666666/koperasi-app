"use server";

import { cookies } from "next/headers";

const COOKIE_NAME = "cashier_identity_id";

export async function setCashierIdentity(identityId: number) {
    const cookieStore = await cookies();
    cookieStore.set(COOKIE_NAME, String(identityId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24, // 24 hours
    });
}

export async function clearCashierIdentity() {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
}

export async function getCashierIdentityId(): Promise<number | null> {
    const cookieStore = await cookies();
    const value = cookieStore.get(COOKIE_NAME)?.value;
    return value ? parseInt(value) : null;
}
