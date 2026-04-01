import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const q = searchParams.get("q");

        if (!q) {
            return NextResponse.json({ message: "Parameter q wajib diisi" }, { status: 400 });
        }

        // Find member by memberNo or nrp
        const member = await prisma.member.findFirst({
            where: {
                OR: [
                    { memberNo: { contains: q, mode: "insensitive" } },
                    { nrp: { contains: q, mode: "insensitive" } },
                ]
            },
            include: {
                savings: {
                    include: {
                        transactions: {
                            orderBy: { transactionDate: "asc" }
                        }
                    }
                },
                loans: {
                    where: { status: { in: ["active", "overdue"] } },
                    include: {
                        schedules: { orderBy: { dueDate: "asc" } },
                        payments: { orderBy: { paymentDate: "asc" } }
                    }
                }
            }
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Total Simpanan
        const totalSimpanan = member.savings.reduce((sum, acc) => sum + Number(acc.balance), 0);
        
        // Sisa Pinjaman
        const sisaPinjaman = member.loans.reduce((sum, loan) => sum + Number(loan.principalOutstanding), 0);

        // Gather all transactions
        let txList = [];

        // 1. Savings Transactions
        for (const account of member.savings) {
            for (const tx of account.transactions) {
                const amount = Number(tx.amount);
                const isDeposit = tx.type === "deposit";
                txList.push({
                    _rawDate: tx.transactionDate,
                    id: `sav-${tx.id}`,
                    date: tx.transactionDate.toISOString().split("T")[0],
                    type: isDeposit ? "simpanan" : "penarikan",
                    description: `${isDeposit ? 'Setoran' : 'Penarikan'} Simpanan (${tx.transactionNo})`,
                    debit: isDeposit ? 0 : amount,
                    credit: isDeposit ? amount : 0,
                });
            }
        }

        // 2. Loans
        for (const loan of member.loans) {
            // Pencairan Pinjaman
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

            // Angsuran
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

        // Sort globally by date
        txList.sort((a, b) => new Date(a._rawDate).getTime() - new Date(b._rawDate).getTime());

        // Calculate running balance (Credit - Debit cumulatively)
        let runningBalance = 0;
        const normalizedTxList = txList.map(tx => {
            runningBalance += (tx.credit - tx.debit);
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
                transactions: normalizedTxList.reverse() // Most recent first for UI
            }
        });

    } catch (error) {
        console.error("GET /api/members/book error:", error);
        return NextResponse.json({ message: "Terjadi kesalahan internal" }, { status: 500 });
    }
}
