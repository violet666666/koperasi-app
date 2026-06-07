import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findUnitAccount } from "@/lib/cash-bank";
import { isSameUnit } from "@/lib/unit-aliases";

export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 2 * 1024 * 1024;

const VALID_PAYMENT_METHODS = ["cash", "qris", "lainnya"];

/**
 * POST /api/unit/[slug]/operational-income
 * Body: FormData { amount, description, transactionDate?, receipt? (file), paymentMethod? }
 *
 * Mencatat pemasukan operasional unit di luar transaksi POS kasir.
 * Contoh: pendapatan sewa lahan, pemasukan lama yang belum tercatat, dll.
 * Hanya Admin unit atau Operator yang bisa mengakses.
 */
export async function POST(
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
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mencatat pemasukan." }, { status: 403 });
        }

        let amount: number;
        let description: string;
        let transactionDate: string | null = null;
        let paymentMethod: string = "cash";
        let receiptImagePath: string | null = null;

        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            amount = Number(formData.get("amount"));
            description = String(formData.get("description") || "").trim();
            transactionDate = formData.get("transactionDate") as string | null;
            const pm = String(formData.get("paymentMethod") || "cash");
            if (VALID_PAYMENT_METHODS.includes(pm)) paymentMethod = pm;

            const receiptFile = formData.get("receipt") as File | null;
            if (receiptFile && receiptFile.size > 0) {
                if (receiptFile.size > MAX_FILE_SIZE) {
                    return NextResponse.json({ message: "Ukuran file maksimal 2MB." }, { status: 400 });
                }
                const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
                if (!allowedTypes.includes(receiptFile.type)) {
                    return NextResponse.json({ message: "Format file harus JPG, PNG, atau WebP." }, { status: 400 });
                }

                const bytes = await receiptFile.arrayBuffer();
                const buffer = Buffer.from(bytes);
                const base64String = `data:${receiptFile.type};base64,${buffer.toString("base64")}`;

                const uploadedFile = await prisma.uploadedFile.create({
                    data: {
                        category: "income_receipt",
                        refId: unitType,
                        fileName: receiptFile.name,
                        mimeType: receiptFile.type,
                        base64Data: base64String,
                        sizeBytes: receiptFile.size,
                        uploadedById: parseInt(session.user.id),
                    },
                });

                receiptImagePath = `/api/uploads/${uploadedFile.id}`;
            }
        } else {
            const body = await request.json();
            amount = Number(body.amount);
            description = String(body.description || "").trim();
            transactionDate = body.transactionDate || null;
            const pm = body.paymentMethod || "cash";
            if (VALID_PAYMENT_METHODS.includes(pm)) paymentMethod = pm;
        }

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Nominal pemasukan harus lebih dari 0." }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ message: "Keterangan pemasukan wajib diisi." }, { status: 400 });
        }

        const currentUserId = parseInt(session.user.id);
        const txDate = transactionDate ? new Date(transactionDate) : new Date();

        let branchId = session.user.branchId || 1;
        if (!session.user.branchId) {
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            if (headOffice) branchId = headOffice.id;
        }

        const nominalAmount = amount;
        const transactionNo = `INC-${unitType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

        const descWithMeta = receiptImagePath
            ? `[${unitType.toUpperCase()}] Pemasukan Operasional: ${description}||RECEIPT:${receiptImagePath}`
            : `[${unitType.toUpperCase()}] Pemasukan Operasional: ${description}`;

        const cashTx = await prisma.$transaction(async (tx) => {
            // 3-step account lookup: unitTypes array → unitType → generic operational
            const cashAccount = await findUnitAccount(tx, unitType, "cash");

            if (!cashAccount) throw new Error("Tidak ditemukan akun kas aktif untuk unit ini.");

            // Atomic increment to prevent race condition
            const updatedAccount = await tx.cashBankAccount.update({
                where: { id: cashAccount.id },
                data: { currentBalance: { increment: nominalAmount } },
            });

            const balanceBefore = Number(updatedAccount.currentBalance) - nominalAmount;

            return tx.cashBankTransaction.create({
                data: {
                    transactionNo,
                    accountId: cashAccount.id,
                    branchId,
                    type: "in",
                    category: "operational",
                    amount: nominalAmount,
                    balanceBefore,
                    balanceAfter: Number(updatedAccount.currentBalance),
                    unitType: unitType,
                    paymentMethod,
                    description: descWithMeta,
                    transactionDate: txDate,
                    createdById: currentUserId,
                },
            });
        });

        return NextResponse.json({
            message: "Pemasukan operasional berhasil dicatat.",
            data: {
                transactionNo: cashTx.transactionNo,
                amount: nominalAmount,
                newBalance: Number(cashTx.balanceAfter),
                receiptImagePath,
                description,
                paymentMethod,
            },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit/[slug]/operational-income error:", error);
        return NextResponse.json({ message: "Gagal mencatat pemasukan operasional." }, { status: 500 });
    }
}
