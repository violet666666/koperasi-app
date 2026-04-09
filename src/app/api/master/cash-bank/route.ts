import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/master/cash-bank — list all CashBankAccounts (including inactive for admin)
export async function GET() {
    try {
        const accounts = await prisma.cashBankAccount.findMany({
            where: { deletedAt: null },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                glAccount: { select: { id: true, code: true, name: true } },
                _count: { select: { transactions: true } },
            },
            orderBy: [{ type: "asc" }, { code: "asc" }],
        });

        return NextResponse.json({ data: accounts });
    } catch (error) {
        console.error("GET /api/master/cash-bank error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil data Kas & Bank" },
            { status: 500 }
        );
    }
}

// POST /api/master/cash-bank — create new CashBankAccount
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { code, name, type, bankName, accountNumber, branchId, glAccountId, unitType, unitTypes, purpose } = body;

        if (!code || !name || !type || !branchId) {
            return NextResponse.json(
                { message: "Kode, Nama, Tipe, dan Cabang wajib diisi." },
                { status: 400 }
            );
        }

        if (!["cash", "bank"].includes(type)) {
            return NextResponse.json(
                { message: "Tipe harus 'cash' atau 'bank'." },
                { status: 400 }
            );
        }

        // Validate unique code
        const existing = await prisma.cashBankAccount.findUnique({
            where: { code },
        });
        if (existing) {
            return NextResponse.json(
                { message: `Kode "${code}" sudah digunakan oleh akun lain.` },
                { status: 400 }
            );
        }

        // Validate glAccountId if provided
        if (glAccountId) {
            const account = await prisma.account.findUnique({ where: { id: glAccountId } });
            if (!account) {
                return NextResponse.json(
                    { message: "Akun Bagan Akun (COA) tidak ditemukan." },
                    { status: 400 }
                );
            }
        }

        const created = await prisma.cashBankAccount.create({
            data: {
                code,
                name,
                type,
                bankName: type === "bank" ? bankName : null,
                accountNumber: type === "bank" ? accountNumber : null,
                branchId: parseInt(branchId),
                glAccountId: glAccountId ? parseInt(glAccountId) : null,
                unitType: unitType || null,
                unitTypes: Array.isArray(unitTypes) && unitTypes.length > 0 ? unitTypes : undefined,
                purpose: purpose || "operasional",
                currentBalance: 0,
                isActive: true,
            },
            include: {
                branch: { select: { id: true, name: true, code: true } },
                glAccount: { select: { id: true, code: true, name: true } },
            },
        });

        return NextResponse.json({ data: created }, { status: 201 });
    } catch (error) {
        console.error("POST /api/master/cash-bank error:", error);
        return NextResponse.json(
            { message: "Gagal membuat akun Kas & Bank." },
            { status: 500 }
        );
    }
}
