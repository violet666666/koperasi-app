import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * POST /api/unit/[slug]/operational-expense
 * Body: FormData { amount, description, transactionDate?, receipt? (file) }
 *
 * Mencatat pengeluaran operasional unit ke CashBankTransaction.
 * Mendukung upload foto bukti/struk (opsional).
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
        const isAdminUnit = roleName === "admin" && userUnitType === unitType;

        if (!isOperator && !isAdminUnit) {
            return NextResponse.json({ message: "Hanya Admin Unit atau Operator yang dapat mencatat pengeluaran." }, { status: 403 });
        }

        // Parse FormData (support file upload)
        let amount: number;
        let description: string;
        let transactionDate: string | null = null;
        let receiptImagePath: string | null = null;

        const contentType = request.headers.get("content-type") || "";
        
        if (contentType.includes("multipart/form-data")) {
            const formData = await request.formData();
            amount = Number(formData.get("amount"));
            description = String(formData.get("description") || "").trim();
            transactionDate = formData.get("transactionDate") as string | null;
            
            const receiptFile = formData.get("receipt") as File | null;
            if (receiptFile && receiptFile.size > 0) {
                // Validasi ukuran max 5MB
                if (receiptFile.size > 5 * 1024 * 1024) {
                    return NextResponse.json({ message: "Ukuran file maksimal 5MB." }, { status: 400 });
                }
                // Buat folder jika belum ada
                const uploadDir = path.join(process.cwd(), "public", "uploads", "expenses", unitType);
                await mkdir(uploadDir, { recursive: true });
                
                // Generate unique filename
                const ext = receiptFile.name.split(".").pop() || "jpg";
                const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;
                const filePath = path.join(uploadDir, filename);
                
                const bytes = await receiptFile.arrayBuffer();
                await writeFile(filePath, Buffer.from(bytes));
                
                // Path yang bisa diakses via browser
                receiptImagePath = `/uploads/expenses/${unitType}/${filename}`;
            }
        } else {
            // Fallback: JSON body (backward compat)
            const body = await request.json();
            amount = Number(body.amount);
            description = String(body.description || "").trim();
            transactionDate = body.transactionDate || null;
        }

        if (!amount || amount <= 0) {
            return NextResponse.json({ message: "Nominal pengeluaran harus lebih dari 0." }, { status: 400 });
        }
        if (!description) {
            return NextResponse.json({ message: "Keterangan pengeluaran wajib diisi." }, { status: 400 });
        }

        const currentUserId = parseInt(session.user.id);
        const txDate = transactionDate ? new Date(transactionDate) : new Date();

        // Find cash account for this unit, fallback to head office
        const cashAccount = await prisma.cashBankAccount.findFirst({
            where: { unitType, type: "cash", isActive: true },
        }) || await prisma.cashBankAccount.findFirst({
            where: { type: "cash", isActive: true },
            orderBy: { id: "asc" },
        });

        if (!cashAccount) {
            return NextResponse.json({ message: "Tidak ditemukan akun kas aktif untuk unit ini." }, { status: 404 });
        }

        let branchId = session.user.branchId || 1;
        if (!session.user.branchId) {
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            if (headOffice) branchId = headOffice.id;
        }

        const nominalAmount = amount;
        const currentBalance = Number(cashAccount.currentBalance);
        const newBalance = currentBalance - nominalAmount;
        const transactionNo = `OPS-${unitType.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 4).toUpperCase()}`;

        // Simpan receiptImagePath di description sebagai JSON suffix jika ada
        const descWithMeta = receiptImagePath
            ? `[${unitType.toUpperCase()}] Pengeluaran Operasional: ${description}||RECEIPT:${receiptImagePath}`
            : `[${unitType.toUpperCase()}] Pengeluaran Operasional: ${description}`;

        const cashTx = await prisma.cashBankTransaction.create({
            data: {
                transactionNo,
                accountId: cashAccount.id,
                branchId,
                type: "out",
                category: "operational",
                amount: nominalAmount,
                balanceBefore: currentBalance,
                balanceAfter: newBalance,
                description: descWithMeta,
                transactionDate: txDate,
                createdById: currentUserId,
            },
        });

        await prisma.cashBankAccount.update({
            where: { id: cashAccount.id },
            data: { currentBalance: newBalance },
        });

        return NextResponse.json({
            message: "Pengeluaran operasional berhasil dicatat.",
            data: {
                transactionNo: cashTx.transactionNo,
                amount: nominalAmount,
                newBalance,
                receiptImagePath,
                description: description,
            },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/unit/[slug]/operational-expense error:", error);
        return NextResponse.json({ message: "Gagal mencatat pengeluaran operasional." }, { status: 500 });
    }
}


/**
 * GET /api/unit/[slug]/operational-expense
 * Returns list of operational expenses for the unit (for audit/laporan purposes).
 */
export async function GET(
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

        const expenses = await prisma.cashBankTransaction.findMany({
            where: {
                type: "out",
                category: "operational",
                description: { contains: `[${unitType.toUpperCase()}]` },
            },
            orderBy: { transactionDate: "desc" },
            take: 100,
        });

        return NextResponse.json({
            data: expenses.map((e) => {
                const raw = e.description ?? "";
                const prefix = `[${unitType.toUpperCase()}] Pengeluaran Operasional: `;
                const withoutPrefix = raw.replace(prefix, "");
                // Parse receipt path dari suffix ||RECEIPT:/path
                const receiptSplit = withoutPrefix.split("||RECEIPT:");
                const description = receiptSplit[0];
                const receiptImagePath = receiptSplit[1] || null;
                return {
                    id: e.id,
                    transactionNo: e.transactionNo,
                    date: e.transactionDate,
                    description,
                    amount: Number(e.amount),
                    receiptImagePath,
                };
            }),
        });
    } catch (error) {
        return NextResponse.json({ message: "Gagal mengambil data pengeluaran." }, { status: 500 });
    }
}
