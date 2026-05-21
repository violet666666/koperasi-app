import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";
import { getPlafonPiutang } from "@/lib/plafon";

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

async function generateTxNoMobile(unitType: string, tx: any): Promise<string> {
    const abbr = UNIT_ABBR_TX[unitType] || unitType.substring(0, 2).toUpperCase();
    const now = new Date();
    const d = String(now.getDate()).padStart(2, "0");
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const y = now.getFullYear();
    const datePart = `${d}${m}${y}`;
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const count = await tx.unitTransaction.count({
        where: { unitType, transactionDate: { gte: startOfDay } }
    });
    const seq = String(count + 1).padStart(4, "0");
    return `${abbr}${datePart}${seq}`;
}

// POST /api/mobile/unit-layanan - Process Kasir Cepat from Mobile App
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "kasir" && user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { unitType, amount, paymentMethod, memberId, description, customerName } = body;

        if (!unitType || !amount || !paymentMethod) {
            return NextResponse.json({ message: "Data tidak lengkap: unitType, amount, paymentMethod wajib diisi" }, { status: 400 });
        }

        const totalAmount = Number(amount);
        if (isNaN(totalAmount) || totalAmount <= 0) {
            return NextResponse.json({ message: "Amount harus berupa angka positif" }, { status: 400 });
        }

        if (!VALID_UNIT_TYPES.includes(unitType)) {
            return NextResponse.json({ message: `unitType '${unitType}' tidak valid` }, { status: 400 });
        }

        let method = paymentMethod;
        if (method === "credit") method = "salary_cut";
        if (!VALID_PAYMENT_METHODS.includes(method)) {
            return NextResponse.json({ message: `paymentMethod '${paymentMethod}' tidak valid` }, { status: 400 });
        }

        if (method === "salary_cut" && !memberId) {
            return NextResponse.json({ message: "Member ID diperlukan untuk potong gaji" }, { status: 400 });
        }

        const userId = Number(user.id);

        // ── Validasi plafon piutang untuk salary_cut ──────────────────
        if (method === "salary_cut" && memberId) {
            const member = await prisma.member.findUnique({
                where: { id: Number(memberId) },
                select: { id: true, name: true, plafonPiutang: true, nrp: true, salary: true, sisaGaji: true },
            });

            if (!member) {
                return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
            }

            const tagihanUnitTx = await prisma.unitTransaction.aggregate({
                where: {
                    memberId: member.id,
                    paymentMethod: "salary_cut",
                    isPaid: false,
                    status: { in: ["completed", "pending_void"] },
                },
                _sum: { amount: true },
            });

            const totalTagihan = Number(tagihanUnitTx._sum?.amount ?? 0);
            const plafonPiutang = getPlafonPiutang(member);

            const sisaLimit = plafonPiutang - totalTagihan;

            if (totalAmount > sisaLimit) {
                return NextResponse.json({
                    message: `Transaksi ditolak: Sisa limit piutang Rp ${sisaLimit.toLocaleString("id-ID")} tidak cukup. Plafon: Rp ${plafonPiutang.toLocaleString("id-ID")}, Tagihan aktif: Rp ${totalTagihan.toLocaleString("id-ID")}.`,
                    sisaLimit,
                    plafonPiutang,
                    totalTagihan,
                }, { status: 400 });
            }
        }

        const now = new Date();

        // ── INTERACTIVE TRANSACTION: Atomic multi-table operations ─────
        const result = await prisma.$transaction(async (tx) => {
            const trxNo = await generateTxNoMobile(unitType, tx);

            // 1. Create UnitTransaction
            const unitTx = await tx.unitTransaction.create({
                data: {
                    transactionNo: trxNo,
                    memberId: memberId ? Number(memberId) : null,
                    unitType: unitType,
                    description: description || `Pembayaran ${unitType} (Mobile) - ${customerName || "Walk-in"}`,
                    amount: totalAmount,
                    transactionDate: now,
                    paymentMethod: method,
                    isPaid: method !== "salary_cut",
                    paidDate: method !== "salary_cut" ? now : null,
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
                    const freshAccount = await tx.cashBankAccount.findUnique({ where: { id: targetAccount.id } });
                    if (freshAccount) {
                        const currentBal = Number(freshAccount.currentBalance);
                        const newBal = currentBal + totalAmount;

                        await tx.cashBankTransaction.create({
                            data: {
                                transactionNo: `UL-M-${method === 'cash' ? 'KAS' : 'BNK'}-${Date.now().toString(36).toUpperCase()}`,
                                accountId: freshAccount.id,
                                branchId: freshAccount.branchId,
                                type: "in",
                                category: "pendapatan_unit",
                                amount: totalAmount,
                                balanceBefore: currentBal,
                                balanceAfter: newBal,
                                unitType: unitType,
                                description: `Pendapatan ${unitType} (Mobile) ${method === 'cash' ? 'Tunai' : 'QRIS'} - ${trxNo}`,
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
                            description: `Pendapatan ${unitType} (Mobile) - ${trxNo}`,
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
                                description: method === "salary_cut" ? `Piutang (M) ${unitType}` : `Kas masuk (M) ${unitType}`,
                            },
                            {
                                journalId: journal.id,
                                accountId: incomeAccount.id,
                                debit: 0,
                                credit: totalAmount,
                                description: `Pendapatan (M) ${unitType}`,
                            },
                        ],
                    });
                }
            }

            return { unitTx, trxNo };
        }, { maxWait: 10000, timeout: 30000 });

        // Audit Log
        try {
            await logAudit({
                userId: userId,
                userName: user.name || "Mobile User",
                userRole: user.role || "kasir",
                action: "CREATE", module: "Unit_Layanan",
                description: `Kasir Cepat Mobile ${method}: ${result.trxNo} - Rp ${totalAmount.toLocaleString()}`,
                targetId: String(result.unitTx.id), targetType: "UnitTransaction",
                newData: { transactionNo: result.trxNo, amount: totalAmount, paymentMethod: method },
            });
        } catch (e) {}

        return NextResponse.json({
            data: {
                transactionNo: result.unitTx.transactionNo,
                totalAmount: Number(result.unitTx.amount),
                paymentMethod: method,
            },
        }, { status: 201 });
    } catch (error) {
        console.error("POST /api/mobile/unit-layanan error:", error);
        return NextResponse.json({ message: "Gagal memproses transaksi kasir cepat" }, { status: 500 });
    }
}
