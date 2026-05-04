import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/members/[id]/transactions — Member transaction history (Buku Anggota)
export async function GET(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const memberId = parseInt(id);
        if (isNaN(memberId)) {
            return NextResponse.json({ message: "ID anggota tidak valid" }, { status: 400 });
        }

        const member = await prisma.member.findUnique({
            where: { id: memberId },
            include: {
                savingsAccounts: {
                    include: {
                        transactions: {
                            orderBy: { transactionDate: "asc" },
                        },
                    },
                },
                loans: {
                    where: { status: { in: ["active", "overdue", "paid_off"] } },
                    include: {
                        payments: { orderBy: { paymentDate: "asc" } },
                    },
                },
            },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        const totalSimpanan = member.savingsAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0);
        const sisaPinjaman = member.loans
            .filter((l) => l.status !== "paid_off")
            .reduce((sum, loan) => sum + Number(loan.principalOutstanding), 0);

        const txList: Array<{
            _rawDate: Date;
            id: string;
            date: string;
            type: string;
            description: string;
            debit: number;
            credit: number;
        }> = [];

        // Savings transactions
        for (const account of member.savingsAccounts) {
            for (const tx of account.transactions) {
                if (tx.status !== "completed") continue;
                const amount = Number(tx.amount);
                const isDeposit = tx.type === "deposit";
                txList.push({
                    _rawDate: tx.transactionDate,
                    id: `sav-${tx.id}`,
                    date: tx.transactionDate.toISOString().split("T")[0],
                    type: isDeposit ? "simpanan" : "penarikan",
                    description: `${isDeposit ? "Setoran" : "Penarikan"} Simpanan (${tx.transactionNo})`,
                    debit: isDeposit ? 0 : amount,
                    credit: isDeposit ? amount : 0,
                });
            }
        }

        // Loans
        for (const loan of member.loans) {
            const amount = Number(loan.disbursedAmount || loan.principalAmount);
            txList.push({
                _rawDate: loan.disbursementDate || loan.createdAt,
                id: `loan-${loan.id}`,
                date: (loan.disbursementDate || loan.createdAt).toISOString().split("T")[0],
                type: "pinjaman",
                description: `Pencairan Pinjaman (${loan.loanNo})`,
                debit: 0,
                credit: amount,
            });

            for (const payment of loan.payments) {
                const payAmount = Number(payment.principalPortion) + Number(payment.interestPortion);
                txList.push({
                    _rawDate: payment.paymentDate,
                    id: `pay-${payment.id}`,
                    date: payment.paymentDate.toISOString().split("T")[0],
                    type: "angsuran",
                    description: `Angsuran Pinjaman (${payment.paymentNo})`,
                    debit: payAmount,
                    credit: 0,
                });
            }
        }

        txList.sort((a, b) => new Date(a._rawDate).getTime() - new Date(b._rawDate).getTime());

        let runningBalance = 0;
        const transactions = txList.map((tx) => {
            runningBalance += tx.credit - tx.debit;
            return {
                id: tx.id,
                date: tx.date,
                type: tx.type,
                description: tx.description,
                debit: tx.debit,
                credit: tx.credit,
                balance: runningBalance,
            };
        });

        return NextResponse.json({
            data: {
                memberId: member.id,
                memberNo: member.memberNo,
                name: member.name,
                totalSimpanan,
                sisaPinjaman,
                transactions: transactions.reverse(),
            },
        });
    } catch (error) {
        console.error("GET /api/members/[id]/transactions error:", error);
        return NextResponse.json({ message: "Gagal memuat riwayat transaksi" }, { status: 500 });
    }
}
