import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// POST /api/unit-layanan/sales - Process Kasir Cepat
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { unitType, amount, paymentMethod, memberId, description, customerName, createdById } = body;

        if (!unitType || !amount || !paymentMethod) {
            return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
        }

        const userId = createdById || 1;
        const totalAmount = Number(amount);
        const method = paymentMethod; // cash, qris, salary_cut

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        const now = new Date();
        const trxNo = `${unitType.substring(0, 3).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

        // 1. Create UnitTransaction specifically as the single source of truth for Kasir Cepat
        const ut = await prisma.unitTransaction.create({
            data: {
                transactionNo: trxNo,
                memberId: method === "salary_cut" ? memberId : null,
                unitType: unitType,
                description: description || `Pembayaran ${unitType} - ${customerName || "Walk-in"}`,
                amount: totalAmount,
                transactionDate: now,
                paymentMethod: method,
                isPaid: method !== "salary_cut", // If cash/qris, it's paid immediately
                paidDate: method !== "salary_cut" ? now : null,
                createdById: userId,
            }
        });

        // 2. Synchronize to Cash / Bank if Cash/Qris
        if (method === "cash" || method === "qris") {
            try {
                const targetAccount = await prisma.cashBankAccount.findFirst({
                    where: { 
                        type: method === "cash" ? "cash" : "bank",
                        unitType: unitType,
                        isActive: true 
                    },
                    orderBy: { id: "asc" },
                });

                if (targetAccount) {
                    const currentBal = Number(targetAccount.currentBalance);
                    const newBal = currentBal + totalAmount;

                    await prisma.cashBankTransaction.create({
                        data: {
                            transactionNo: `UL-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                            accountId: targetAccount.id,
                            branchId: targetAccount.branchId,
                            type: "in",
                            category: "pendapatan_unit",
                            amount: totalAmount,
                            balanceBefore: currentBal,
                            balanceAfter: newBal,
                            description: `Pendapatan ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${trxNo}`,
                            transactionDate: now,
                            createdById: userId,
                        },
                    });

                    await prisma.cashBankAccount.update({
                        where: { id: targetAccount.id },
                        data: { currentBalance: newBal },
                    });
                } else {
                    console.error(`[Quick-POS] Rekening ${method} untuk unit ${unitType} tidak ditemukan. Uang tidak tercatat di kas/bank.`);
                }
            } catch (cashErr) {
                console.error("[Quick-POS] Gagal sinkronisasi kas:", cashErr);
            }
        }

        // 3. Simple Journaling
        try {
            const currentPeriod = await prisma.fiscalPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
            const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
            const kasAccount = await prisma.account.findFirst({ where: { code: "1101" } });
            const piutangAccount = await prisma.account.findFirst({ where: { code: "1301" } }); // You can adjust COA mapper later
            const incomeAccount = await prisma.account.findFirst({ where: { code: "4201" } });
            
            if (headOffice && currentPeriod && incomeAccount) {
                const debitAccountId = method === "salary_cut" ? piutangAccount?.id : kasAccount?.id;
                
                if (debitAccountId) {
                    const journalCount = await prisma.journal.count();
                    const journal = await prisma.journal.create({
                        data: {
                            journalNo: `JRN-${now.getFullYear()}${String(journalCount + 1).padStart(5, "0")}`,
                            branchId: headOffice.id,
                            transactionDate: now,
                            description: `Pendapatan ${unitType} - ${trxNo}`,
                            sourceType: "unit_transaction",
                            periodId: currentPeriod.id,
                            isPosted: true,
                            createdById: userId,
                        },
                    });

                    await prisma.journalLine.createMany({
                        data: [
                            {
                                journalId: journal.id,
                                accountId: debitAccountId,
                                debit: totalAmount,
                                credit: 0,
                                description: method === "salary_cut" ? `Piutang ${unitType}` : `Kas masuk ${unitType}`,
                            },
                            {
                                journalId: journal.id,
                                accountId: incomeAccount.id,
                                debit: 0,
                                credit: totalAmount,
                                description: `Pendapatan ${unitType}`,
                            },
                        ],
                    });
                }
            }
        } catch (journalErr) {
            console.error("[Quick-POS] Journal Error:", journalErr);
        }

        // Audit Log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Unit_Layanan",
                description: `Kasir Cepat ${method}: ${trxNo} - Rp ${totalAmount.toLocaleString()}`,
                targetId: String(ut.id), targetType: "UnitTransaction",
                newData: { transactionNo: trxNo, amount: totalAmount, paymentMethod: method },
            });
        } catch (e) {}

        return NextResponse.json({
            data: {
                transactionNo: ut.transactionNo,
                totalAmount: Number(ut.amount),
                paymentMethod: method,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/unit-layanan/sales error:", error);
        return NextResponse.json({ message: "Failed to process quick sale" }, { status: 500 });
    }
}
