import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

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

const VALID_UNIT_TYPES = Object.keys(UNIT_ABBR_TX);
const VALID_PAYMENT_METHODS = ["cash", "qris", "salary_cut", "credit"];

async function generateTxNo(unitType: string, tx: any, date?: Date): Promise<string> {
    const abbr = UNIT_ABBR_TX[unitType] || unitType.substring(0, 2).toUpperCase();
    const d = date || new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const y = d.getFullYear();
    const datePart = `${dd}${mm}${y}`;
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const count = await tx.unitTransaction.count({
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

        const role = (session.user as any).role as string;
        if (role === "anggota") {
            return NextResponse.json({ message: "Anggota tidak diizinkan membuat transaksi kasir" }, { status: 403 });
        }

        const body = await request.json();
        const { unitType, amount, paymentMethod, memberId, description, customerName, vehiclePlate, transactionDate } = body;

        // Validasi input wajib
        if (!unitType || !amount || !paymentMethod) {
            return NextResponse.json({ message: "Data tidak lengkap: unitType, amount, paymentMethod wajib diisi" }, { status: 400 });
        }

        // Validasi tipe dan nilai amount
        const totalAmount = Number(amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            return NextResponse.json({ message: "Amount harus berupa angka positif" }, { status: 400 });
        }

        // Validasi unitType dari daftar yang valid
        if (!VALID_UNIT_TYPES.includes(unitType)) {
            return NextResponse.json({ message: `unitType '${unitType}' tidak valid` }, { status: 400 });
        }

        // Normalisasi payment method
        let method = paymentMethod;
        if (method === "credit") method = "salary_cut";
        if (!VALID_PAYMENT_METHODS.includes(method)) {
            return NextResponse.json({ message: `paymentMethod '${paymentMethod}' tidak valid` }, { status: 400 });
        }

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        const userId = Number(session.user.id);

        // ── Validasi plafon piutang untuk salary_cut ──────────────────
        let memberForValidation: any = null;
        if (method === "salary_cut" && memberId) {
            memberForValidation = await prisma.member.findUnique({
                where: { id: Number(memberId) },
                select: { id: true, name: true, plafonPiutang: true, nrp: true, salary: true, tunlesKinerja: true },
            });

            if (!memberForValidation) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }

            const tagihanUnitTx = await prisma.unitTransaction.aggregate({
                where: {
                    memberId: memberForValidation.id,
                    paymentMethod: "salary_cut",
                    isPaid: false,
                    status: { in: ["completed", "pending_void"] },
                },
                _sum: { amount: true },
            });

            const totalTagihan = Number(tagihanUnitTx._sum?.amount ?? 0);
            let plafonPiutang = Number(memberForValidation.plafonPiutang || 0);

            if (plafonPiutang === 0 && Number(memberForValidation.salary || 0) > 0) {
                const activeLoans = await prisma.loan.findMany({
                    where: { memberId: memberForValidation.id, status: { in: ["active", "overdue"] } },
                    select: { monthlyInstallment: true }
                });
                const totalAngsuran = activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment || 0), 0);
                const salary = Number(memberForValidation.salary || 0);
                const tunkin = Number(memberForValidation.tunlesKinerja || 0);
                const sisaBersih = salary + tunkin - totalAngsuran;
                const batasAman = 2000000;
                plafonPiutang = Math.max(0, sisaBersih - batasAman);
            }

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

        // Parse transaction date (backdate support for old transactions)
        let now = new Date();
        if (transactionDate) {
            const parsed = new Date(transactionDate);
            if (isNaN(parsed.getTime())) {
                return NextResponse.json({ message: "Format tanggal tidak valid" }, { status: 400 });
            }
            if (parsed > new Date()) {
                return NextResponse.json({ message: "Tanggal transaksi tidak boleh lebih dari hari ini" }, { status: 400 });
            }
            now = parsed;
        }

        // ── INTERACTIVE TRANSACTION: Atomic multi-table operations ─────
        const ut = await prisma.$transaction(async (tx) => {
            const trxNo = await generateTxNo(unitType, tx, now);

            // 1. Create UnitTransaction
            const unitTx = await tx.unitTransaction.create({
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
                    notes: vehiclePlate ? `[PLAT:${vehiclePlate.trim().toUpperCase()}]` : null,
                    createdById: userId,
                }
            });

            // 2. Cash/Bank sync
            if (method === "cash" || method === "qris") {
                const accountType = method === "cash" ? "cash" : "bank";

                let targetAccount = await tx.cashBankAccount.findFirst({
                    where: {
                        type: accountType,
                        isActive: true,
                        unitTypes: { array_contains: unitType } as any,
                    },
                    orderBy: { id: "asc" },
                });

                if (!targetAccount) {
                    targetAccount = await tx.cashBankAccount.findFirst({
                        where: { type: accountType, unitType: unitType, isActive: true },
                        orderBy: { id: "asc" },
                    });
                }

                if (!targetAccount) {
                    targetAccount = await tx.cashBankAccount.findFirst({
                        where: { type: accountType, unitType: null, purpose: "operasional", isActive: true },
                        orderBy: { id: "asc" },
                    });
                }

                if (targetAccount) {
                    // Re-read di dalam transaction untuk mendapat nilai terbaru
                    const freshAccount = await tx.cashBankAccount.findUnique({ where: { id: targetAccount.id } });
                    if (freshAccount) {
                        const currentBal = Number(freshAccount.currentBalance);
                        const newBal = currentBal + totalAmount;

                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `UL-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                                accountId: freshAccount.id,
                                branchId: freshAccount.branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: totalAmount,
                                balanceBefore: currentBal,
                                balanceAfter: newBal,
                                unitType: unitType,
                                description: `Pendapatan ${unitType} ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${trxNo}`,
                                transactionDate: now,
                                createdById: userId,
                            },
                        });

                        await tx.cashBankAccount.update({
                            where: { id: freshAccount.id },
                            data: { currentBalance: newBal },
                        });
                    }
                }
            }

            // 3. Journal entry
            const currentPeriod = await tx.fiscalPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
            const headOffice = await tx.branch.findFirst({ where: { isHeadOffice: true } });
            const kasAccount = await tx.account.findFirst({ where: { code: "1101" } });
            const piutangAccount = await tx.account.findFirst({ where: { code: "1301" } });
            const incomeAccount = await tx.account.findFirst({ where: { code: "4201" } });

            if (headOffice && currentPeriod && incomeAccount) {
                const debitAccountId = method === "salary_cut" ? piutangAccount?.id : kasAccount?.id;

                if (debitAccountId) {
                    const journalCount = await tx.journal.count();
                    const journal = await tx.journal.create({
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

                    await tx.journalLine.createMany({
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

            return { unitTx, trxNo };
        }, { maxWait: 10000, timeout: 30000 });

        // Audit Log (di luar transaction karena non-kritis)
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Unit_Layanan",
                description: `Kasir Cepat ${method}: ${ut.trxNo} - Rp ${totalAmount.toLocaleString()}`,
                targetId: String(ut.unitTx.id), targetType: "UnitTransaction",
                newData: { transactionNo: ut.trxNo, amount: totalAmount, paymentMethod: method },
            });
        } catch (e) {}

        return NextResponse.json({
            data: {
                transactionNo: ut.unitTx.transactionNo,
                totalAmount: Number(ut.unitTx.amount),
                paymentMethod: method,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/unit-layanan/sales error:", error);
        return NextResponse.json({ message: "Gagal memproses transaksi kasir cepat" }, { status: 500 });
    }
}
