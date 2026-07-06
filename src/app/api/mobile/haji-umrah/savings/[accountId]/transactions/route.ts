import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../../middleware";
import { processHajiUmrahDeposit, HajiUmrahSavingsError } from "@/lib/services/haji-umrah-savings";

// POST /api/mobile/haji-umrah/savings/[accountId]/transactions — Setoran H&U (mobile)
// Mirrors web POST /api/haji-umrah/savings/[accountId]/transactions (T2) via the shared
// money-core helper processHajiUmrahDeposit (T1). Auth + RBAC + audit + response-wrap here;
// the atomic $transaction lives in the helper.
export async function POST(
    request: Request,
    { params }: { params: Promise<{ accountId: string }> }
) {
    const user = await getMobileUserWithScope(request);
    if (!user) return unauthorizedResponse();
    // WRITE gate — STRICTER than reads: operator always; admin ONLY if unitType haji_umrah;
    // admin_sp / kasir / anggota / all others → 403. user.unitType is DB-sourced (fresh).
    const allowed = user.role === "operator" || (user.role === "admin" && user.unitType === "haji_umrah");
    if (!allowed) return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });

    try {
        const { accountId } = await params;
        const id = parseInt(accountId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid accountId" }, { status: 400 });
        const { amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate } = await request.json();
        const result = await processHajiUmrahDeposit({ accountId: id, amount, paymentMethod, cashBankAccountId, referenceNo, notes, transactionDate, userId: Number(user.id) });

        await prisma.auditLog.create({ data: {
            action: "CREATE", module: "Haji-Umrah",
            description: `Setoran H&U rekening ${id}: ${amount}`,
            userId: Number(user.id), userName: user.name, userRole: user.role, status: "success",
            newData: JSON.stringify({ accountId: id, amount, txnNo: result.transaction.transactionNo }),
        }}).catch(() => {});

        return NextResponse.json({ data: result.transaction, meta: result.meta }, { status: 201 });
    } catch (error: unknown) {
        if (error instanceof HajiUmrahSavingsError) return NextResponse.json({ message: error.message }, { status: error.statusCode });
        console.error("POST /api/mobile/haji-umrah/savings/[accountId]/transactions error:", error);
        return NextResponse.json({ message: "Failed to create transaction" }, { status: 500 });
    }
}
