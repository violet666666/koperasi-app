import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const accountIdParam = searchParams.get("accountId");
        const limitStr = searchParams.get("limit");
        
        if (!accountIdParam) {
            return NextResponse.json({ message: "Account ID tidak disediakan" }, { status: 400 });
        }

        const accountId = parseInt(accountIdParam);
        const limit = limitStr ? parseInt(limitStr) : 100;

        const account = await prisma.account.findUnique({
            where: { id: accountId },
        });

        if (!account) {
            return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
        }

        // Ambil semua line yg memuat ID akun terpilih, terhubung dgn jurnal rekam
        const lines = await prisma.journalLine.findMany({
            where: {
                accountId,
                journal: { isPosted: true },
            },
            include: {
                journal: { select: { transactionDate: true, description: true, journalNo: true, isAdjustment: true } }
            },
            orderBy: {
                journal: { transactionDate: "asc" },
            },
            take: 1000, 
        });

        // Hitung running balance dari awal hingga end record
        let currentBalance = 0;
        const ledgerData = lines.map((line) => {
            const deb = Number(line.debit);
            const cre = Number(line.credit);
            
            if (account.normalBalance === "debit") {
                currentBalance += (deb - cre);
            } else {
                currentBalance += (cre - deb);
            }

            return {
                id: line.id,
                date: line.journal.transactionDate.toISOString(),
                journalNo: line.journal.journalNo,
                description: line.description || line.journal.description,
                isAdjustment: line.journal.isAdjustment,
                debit: deb,
                credit: cre,
                balance: currentBalance,
            };
        });

        // Kita reverse array-nya supaya tampilan table HP yg paling baru di atas
        ledgerData.reverse();

        return NextResponse.json({
            data: {
                account: {
                    id: account.id,
                    code: account.code,
                    name: account.name,
                    normalBalance: account.normalBalance,
                    type: account.type,
                },
                endingBalance: currentBalance,
                ledger: ledgerData.slice(0, limit),
            }
        });

    } catch (error) {
        console.error("GET /api/mobile/ledger error:", error);
        return NextResponse.json({ message: "Gagal memuat data buku besar" }, { status: 500 });
    }
}
