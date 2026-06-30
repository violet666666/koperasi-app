import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { findUnitAccount } from "@/lib/cash-bank";
import { isSameUnit } from "@/lib/unit-aliases";
import { resolveIncomeMode } from "@/lib/services/operational-income-helpers";

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
        let jenis: string = "operasional";
        let memberId: string | null = null;

        const contentType = request.headers.get("content-type") || "";

        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            amount = Number(formData.get("amount"));
            description = String(formData.get("description") || "").trim();
            transactionDate = formData.get("transactionDate") as string | null;
            const pm = String(formData.get("paymentMethod") || "cash");
            if (VALID_PAYMENT_METHODS.includes(pm)) paymentMethod = pm;

            const j = String(formData.get("jenis") || "operasional");
            if (j === "customer" || j === "operasional") jenis = j;
            memberId = (formData.get("memberId") as string | null) || null;

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

            jenis = body.jenis === "customer" ? "customer" : "operasional";
            memberId = body.memberId ?? null;
        }

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Nominal pemasukan harus lebih dari 0." }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ message: "Keterangan pemasukan wajib diisi." }, { status: 400 });
        }

        const mode = resolveIncomeMode(jenis, memberId);
        if (mode.memberId) {
            const memberExists = await prisma.member.findUnique({ where: { id: mode.memberId }, select: { id: true } });
            if (!memberExists) {
                return NextResponse.json({ message: "Anggota tidak ditemukan." }, { status: 404 });
            }
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

        const result = await prisma.$transaction(async (tx) => {
            if (mode.createsUnitTransaction) {
                // === TRANSAKSI CUSTOMER: create UnitTransaction (+ CB pendapatan_unit utk cash/qris) ===
                const abbr = unitType.substring(0, 2).toUpperCase(); // sederhana; bisa pakai UNIT_ABBR_TX
                const d = txDate;
                const dd = String(d.getDate()).padStart(2, "0");
                const mm = String(d.getMonth() + 1).padStart(2, "0");
                const y = d.getFullYear();
                const startOfTxDay = new Date(y, d.getMonth(), d.getDate());
                const countToday = await tx.unitTransaction.count({
                    where: { unitType, transactionDate: { gte: startOfTxDay } },
                });
                const utNo = `${abbr}${dd}${mm}${y}${String(countToday + 1).padStart(4, "0")}`;
                const utNotes = receiptImagePath
                    ? `[Transaksi Customer - Catat Pemasukan]||RECEIPT:${receiptImagePath}`
                    : `[Transaksi Customer - Catat Pemasukan]`;

                await tx.unitTransaction.create({
                    data: {
                        transactionNo: utNo,
                        memberId: mode.memberId,
                        unitType,
                        description: description,
                        amount: nominalAmount,
                        transactionDate: txDate,
                        paymentMethod,
                        isPaid: true,
                        paidDate: txDate,
                        notes: utNotes,
                        createdById: currentUserId,
                    },
                });

                // Cash increment + CB pendapatan_unit (mirror ala unit-layanan/sales) — HANYA utk cash/qris.
                // "lainnya" = non-kas, tidak sentuh saldo kas.
                let cbTxNo: string | null = null;
                if (paymentMethod === "cash" || paymentMethod === "qris") {
                    const accountType = paymentMethod === "cash" ? "cash" : "bank";
                    const targetAccount = await findUnitAccount(tx, unitType, accountType);
                    if (targetAccount) {
                        const updatedAccount = await tx.cashBankAccount.update({
                            where: { id: targetAccount.id },
                            data: { currentBalance: { increment: nominalAmount } },
                        });
                        const balanceBefore = Number(updatedAccount.currentBalance) - nominalAmount;
                        const created = await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `UL-${paymentMethod === "cash" ? "KAS" : "BNK"}-${Date.now().toString(36).toUpperCase()}`,
                                accountId: targetAccount.id,
                                branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: nominalAmount,
                                balanceBefore,
                                balanceAfter: Number(updatedAccount.currentBalance),
                                unitType,
                                paymentMethod,
                                description: `Pendapatan ${unitType} ${paymentMethod === "cash" ? "Tunai" : "QRIS"} - ${utNo}`,
                                transactionDate: txDate,
                                createdById: currentUserId,
                            },
                        });
                        cbTxNo = created.transactionNo;
                    }
                }
                return { kind: "customer" as const, transactionNo: utNo, cbTxNo, amount: nominalAmount, memberId: mode.memberId };
            }

            // === PEMASUKAN OPERASIONAL (current behavior) ===
            const cashAccount = await findUnitAccount(tx, unitType, "cash");
            if (!cashAccount) throw new Error("Tidak ditemukan akun kas aktif untuk unit ini.");
            const updatedAccount = await tx.cashBankAccount.update({
                where: { id: cashAccount.id },
                data: { currentBalance: { increment: nominalAmount } },
            });
            const balanceBefore = Number(updatedAccount.currentBalance) - nominalAmount;
            const created = await tx.cashBankTransaction.create({
                data: {
                    transactionNo,
                    accountId: cashAccount.id,
                    branchId,
                    type: "in",
                    category: "operational",
                    amount: nominalAmount,
                    balanceBefore,
                    balanceAfter: Number(updatedAccount.currentBalance),
                    unitType,
                    paymentMethod,
                    description: descWithMeta,
                    transactionDate: txDate,
                    createdById: currentUserId,
                },
            });
            return { kind: "operasional" as const, transactionNo: created.transactionNo, cbTxNo: null, amount: nominalAmount, newBalance: Number(created.balanceAfter), memberId: null };
        });

        return NextResponse.json({
            message: result.kind === "customer"
                ? "Transaksi customer berhasil dicatat."
                : "Pemasukan operasional berhasil dicatat.",
            data: {
                transactionNo: result.transactionNo,
                amount: nominalAmount,
                newBalance: result.kind === "operasional" ? result.newBalance : undefined,
                receiptImagePath,
                description,
                paymentMethod,
                jenis: result.kind,
                memberId: result.memberId,
            },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit/[slug]/operational-income error:", error);
        return NextResponse.json({ message: "Gagal mencatat pemasukan operasional." }, { status: 500 });
    }
}
