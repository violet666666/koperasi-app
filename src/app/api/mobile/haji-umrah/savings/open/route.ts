import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../middleware";
import { createHajiUmrahAccount, HajiUmrahSavingsError } from "@/lib/services/haji-umrah-savings";

// POST /api/mobile/haji-umrah/savings/open — Buka rekening H&U (mobile)
// Mirrors web POST /api/haji-umrah/savings (T2) via the shared helper createHajiUmrahAccount (T1).
// Auth + RBAC + audit + response-wrap here; the create lives in the helper.
export async function POST(request: Request) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    // WRITE gate — STRICTER than reads: operator always; admin ONLY if unitType haji_umrah;
    // admin_sp / kasir / anggota / all others → 403. user.unitType is DB-sourced (fresh).
    const allowed = user.role === "operator" || (user.role === "admin" && user.unitType === "haji_umrah");
    if (!allowed) return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });

    try {
        const { memberId, productId, targetAmount, monthlyTarget, maturityDate } = await request.json();
        const account = await createHajiUmrahAccount({ memberId, productId, targetAmount, monthlyTarget, maturityDate });

        await prisma.auditLog.create({ data: {
            action: "CREATE", module: "Haji-Umrah",
            description: `Buka rekening H&U ${account.accountNo} (member ${memberId})`,
            userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
            newData: JSON.stringify({ accountId: account.id, accountNo: account.accountNo }),
        }}).catch(() => {});

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) return NextResponse.json({ message: error.message }, { status: error.statusCode });
        console.error("POST /api/mobile/haji-umrah/savings/open error:", error);
        return NextResponse.json({ message: "Failed to create savings account" }, { status: 500 });
    }
}
