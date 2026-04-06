import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// Unit type abbreviations for transaction numbers
const UNIT_ABBR_TX: Record<string, string> = {
    cuci_mobil: "CM",
    barbershop: "BB",
    playstation: "PS",
    play_station: "PS",
    fitness: "FT",
    laundry: "LN",
    resto_cafe: "RC",
    resto: "RC",
    toko: "TK",
    coffe_latar: "CL",
    simpan_pinjam: "SP",
    fotocopy: "FC",
    aset: "AS",
};

// Generate: (ABBR)(DDMMYYYY)(4charRand) — e.g., CM060420261A2B
async function generateTxNo(unitType: string): Promise<string> {
    const abbr = UNIT_ABBR_TX[unitType] || unitType.substring(0, 2).toUpperCase();
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    const datePart = `${d}${m}${y}`;
    // Count today's transactions for this unit type for sequential numbering
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const count = await prisma.unitTransaction.count({
        where: { unitType, transactionDate: { gte: startOfDay } }
    });
    const seq = String(count + 1).padStart(4, "0");
    return `${abbr}${datePart}${seq}`;
}

// POST /api/unit-layanan/sales - Process Kasir Cepat
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { unitType, amount, paymentMethod, memberId, description, customerName, vehiclePlate } = body;

        if (!unitType || !amount || !paymentMethod) {
            return NextResponse.json({ message: "Data tidak lengkap" }, { status: 400 });
        }

        const userId = Number(session.user.id);
        const totalAmount = Number(amount);
        const method = paymentMethod; // cash, qris, salary_cut

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        // ── Validasi anggota & plafon piutang untuk Potong Gaji ──────────────
        if (method === "salary_cut" && memberId) {
            const member = await prisma.member.findUnique({ where: { id: Number(memberId) } });
            if (!member) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }

            // Hitung total tagihan aktif: UnitTransaction (semua unit) + StoreSale potong gaji (toko)
            const [tagihanUnitTx, tagihanStoreSale] = await Promise.all([
                prisma.unitTransaction.aggregate({
                    where: {
                        memberId: member.id,
                        paymentMethod: "salary_cut",
                        isPaid: false,
                        status: { in: ["completed", "pending_void"] },
                    },
                    _sum: { amount: true },
                }),
                prisma.storeSale.aggregate({
                    where: {
                        memberId: member.id,
                        paymentMethod: "salary_cut",
                        // Filter non-voided (cek di bawah)
                    },
                    _sum: { totalAmount: true },
                }),
            ]);

            const totalTagihan = Number(tagihanUnitTx._sum?.amount ?? 0) + Number(tagihanStoreSale._sum?.totalAmount ?? 0);
            const plafonPiutang = Number(member.plafonPiutang || 0);
            const sisaLimit = plafonPiutang - totalTagihan;

            if (totalAmount > sisaLimit) {
                return NextResponse.json({
                    message: `Transaksi ditolak: Sisa limit piutang Rp ${sisaLimit.toLocaleString("id-ID")} tidak cukup untuk transaksi Rp ${totalAmount.toLocaleString("id-ID")}. Plafon: Rp ${plafonPiutang.toLocaleString("id-ID")}, Tagihan aktif: Rp ${totalTagihan.toLocaleString("id-ID")}.`,
                    sisaLimit,
                    plafonPiutang,
                    totalTagihan,
                }, { status: 400 });
            }
        }
        // ── END Validasi Plafon ───────────────────────────────────────────────

        const now = new Date();
        const trxNo = await generateTxNo(unitType);

        // 1. Create UnitTransaction specifically as the single source of truth for Kasir Cepat
        const ut = await prisma.unitTransaction.create({
            data: {
                transactionNo: trxNo,
                memberId: memberId ? Number(memberId) : null,
                unitType: unitType,
                description: description || `Pembayaran ${unitType} - ${customerName || "Walk-in"}`,
                amount: totalAmount,
                transactionDate: now,
                paymentMethod: method,
                isPaid: method !== "salary_cut",
                paidDate: method !== "salary_cut" ? now : null,
                notes: vehiclePlate ? `[PLAT:${vehiclePlate.trim().toUpperCase()}]` : null, // Plat nomor kendaraan
                createdById: userId,
            }
        });

        // 2. Synchronize to Cash / Bank if Cash/Qris
        if (method === "cash" || method === "qris") {
            try {
                let targetAccount = await prisma.cashBankAccount.findFirst({
                    where: { 
                        type: method === "cash" ? "cash" : "bank",
                        unitType: unitType,
                        isActive: true 
                    },
                    orderBy: { id: "asc" },
                });

                if (!targetAccount) {
                    // Fallback to unitType null (pusat / default)
                    targetAccount = await prisma.cashBankAccount.findFirst({
                        where: { 
                            type: method === "cash" ? "cash" : "bank",
                            unitType: null,
                            isActive: true 
                        },
                        orderBy: { id: "asc" },
                    });
                }

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
