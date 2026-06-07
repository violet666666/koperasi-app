import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAuditFromRequest } from "@/lib/audit-logger";
import { isSameUnit } from "@/lib/unit-aliases";
import { storeSaleUnitTypeFilter } from "@/lib/constants/units";

export const dynamic = "force-dynamic";

const VALID_PAYMENT_METHODS = ["cash", "qris", "lainnya"];

/**
 * PATCH /api/unit/[slug]/operational-batch/update-method
 * Body: { ids: number[], paymentMethod: string, type: "expense" | "income" }
 *
 * Batch-update paymentMethod for selected operational income/expense entries.
 * Only updates CashBankTransaction records that belong to the unit and are operational.
 */
export async function PATCH(
    request: Request,
    context: { params: Promise<{ slug: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const params = await context.params;
        const slug = params.slug;
        const unitType = slug.replace(/-/g, "_");

        const roleName = session.user.role;
        const userUnitType = (session.user as any).unitType;
        const isOperator = roleName === "operator" || session.user.permissions?.includes("manage_all");
        const isAdminUnit = roleName === "admin" && isSameUnit(userUnitType, unitType);

        if (!isOperator && !isAdminUnit) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mengubah metode pembayaran." }, { status: 403 });
        }

        const body = await request.json();
        const { ids, paymentMethod, type } = body as {
            ids: number[];
            paymentMethod: string;
            type: "expense" | "income";
        };

        if (!Array.isArray(ids) || ids.length === 0) {
            return NextResponse.json({ message: "Pilih minimal 1 transaksi." }, { status: 400 });
        }

        if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
            return NextResponse.json({ message: "Metode pembayaran tidak valid." }, { status: 400 });
        }

        if (type !== "expense" && type !== "income") {
            return NextResponse.json({ message: "Type harus 'expense' atau 'income'." }, { status: 400 });
        }

        const txType = type === "expense" ? "out" : "in";

        // Verify all IDs belong to this unit's operational transactions (alias-aware)
        const transactions = await prisma.cashBankTransaction.findMany({
            where: {
                id: { in: ids },
                type: txType,
                category: "operational",
                unitType: storeSaleUnitTypeFilter(unitType),
            },
            select: { id: true, transactionNo: true },
        });

        if (transactions.length === 0) {
            return NextResponse.json({ message: "Tidak ada transaksi yang valid ditemukan." }, { status: 404 });
        }

        const validIds = transactions.map(t => t.id);
        const skippedCount = ids.length - validIds.length;

        // Batch update
        const result = await prisma.cashBankTransaction.updateMany({
            where: {
                id: { in: validIds },
                type: txType,
                category: "operational",
            },
            data: {
                paymentMethod,
            },
        });

        // Audit log
        logAuditFromRequest(request, session, {
            action: "UPDATE",
            module: "Laporan",
            description: `Batch ubah metode pembayaran → ${paymentMethod} untuk ${result.count} transaksi ${type === "expense" ? "pengeluaran" : "pemasukan"} operasional unit ${unitType}`,
            targetType: "CashBankTransaction",
            metadata: {
                ids: validIds,
                paymentMethod,
                type,
                count: result.count,
            },
        }).catch(() => {});

        return NextResponse.json({
            message: `Berhasil mengubah metode pembayaran ${result.count} transaksi ke ${paymentMethod === "cash" ? "Tunai" : paymentMethod === "qris" ? "QRIS" : "Lainnya"}.`,
            updated: result.count,
            skipped: skippedCount,
        });

    } catch (error) {
        console.error("PATCH batch update-method error:", error);
        return NextResponse.json({ message: "Gagal mengubah metode pembayaran." }, { status: 500 });
    }
}
