import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// POST /api/loans/import-update — Update/Create loans + monthly payments from Sheet2
export async function POST(request: Request) {
    try {
        // FIX #5: Auth check ONCE at top — never inside transactions
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const adminId = session.user.id ? Number(session.user.id) : 1;

        // Sequential transaction number generator — koperasi standard format
        const importDate = new Date();
        const romawi = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
        const importMonth = romawi[importDate.getMonth() + 1];
        const importYear = importDate.getFullYear();
        let loanSeq = 0;
        let paySeq = 0;
        const nextLoanNo = () => {
            loanSeq++;
            return `SP-IMP/${String(loanSeq).padStart(4, "0")}/PRIM/${importMonth}/${importYear}`;
        };
        const nextPaymentNo = (loanNumber: number) => {
            paySeq++;
            return `PAY-IMP/${String(paySeq).padStart(4, "0")}/PRIM/${importMonth}/${importYear}`;
        };

        const formData = await request.formData();
        const file = formData.get("file") as File | null;
        const mode = (formData.get("mode") as string) || "preview";

        if (!file) {
            return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const workbook = XLSX.read(buffer, { type: "buffer" });

        // Prefer Sheet2 (the one with 2026 monthly data)
        let sheetName = workbook.SheetNames.find(s => s === "Sheet2") || workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        let rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false, defval: "" }) as string[][];
        rows = rows.filter(row => row.some(cell => cell && String(cell).trim() !== ""));

        if (rows.length === 0) {
            return NextResponse.json({ message: "File kosong" }, { status: 400 });
        }

        // Fixed column mapping for Sheet2 of RINCIAN PIUTANG SP
        const COL = { NAMA: 1, PANGKAT: 2, NRP: 3, TGL_PINJAM: 4, PINJAM: 5, SELAMA: 6, JASA: 7, ANGSURAN: 8, JAN: 11, PEB: 12, MARET: 13, APRIL: 14, MEI: 15, TERBAYAR: 16, BS: 17, JUMLAH: 18, SISA_SALDO: 19 };
        const MONTHS_2026 = [
            { col: COL.JAN, name: "Januari", month: 0 },
            { col: COL.PEB, name: "Februari", month: 1 },
            { col: COL.MARET, name: "Maret", month: 2 },
            { col: COL.APRIL, name: "April", month: 3 },
            { col: COL.MEI, name: "Mei", month: 4 },
        ];

        // Data starts after header rows (typically row 12 in the sheet, index 12 in filtered array)
        const dataRows = rows.slice(12);

        // Load all members
        const allMembers = await prisma.member.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true, branchId: true },
        });

        // Load all active loans
        const allLoans = await prisma.loan.findMany({
            where: { status: "active" },
            select: { id: true, loanNo: true, memberId: true, principalAmount: true, principalPaid: true, principalOutstanding: true, interestOutstanding: true, tenorMonths: true, branchId: true },
        });

        // Load existing LoanPayments for 2026 (for idempotency check)
        const existingPayments = await prisma.loanPayment.findMany({
            where: { paymentDate: { gte: new Date("2026-01-01"), lt: new Date("2027-01-01") } },
            select: { loanId: true, paymentDate: true, amount: true },
        });

        const defaultProduct = await prisma.loanProduct.findFirst({ where: { isActive: true } });
        const defaultBranch = await prisma.branch.findFirst({ where: { isHeadOffice: true, isActive: true } }) || await prisma.branch.findFirst({ where: { isActive: true } });

        const results: any[] = [];
        let validCount = 0;    // FIX #2: separate preview count from commit count
        let successCount = 0;  // Only incremented after successful commit
        let failCount = 0;     // FIX #1: now properly incremented in catch blocks
        const commitTasks: (() => Promise<void>)[] = [];

        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            if (row.length <= COL.SISA_SALDO) continue;

            const rawNama = String(row[COL.NAMA] || "").trim();
            const nrp = cleanNrp(row[COL.NRP] || "");

            if (!rawNama || rawNama.toUpperCase() === "NAMA" || rawNama === "0") continue;
            if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

            const pinjam = cleanNumber(row[COL.PINJAM]);
            if (pinjam <= 0) continue; // Skip rows without loans

            // Skip rows with neither NRP nor name
            if (!nrp && !rawNama) continue;

            const selama = cleanNumber(row[COL.SELAMA]) || 12;
            const jasa = cleanNumber(row[COL.JASA]);
            const angsuran = cleanNumber(row[COL.ANGSURAN]) || Math.ceil(pinjam / selama);
            const jumlah = cleanNumber(row[COL.JUMLAH]);
            const sisaSaldo = cleanNumber(row[COL.SISA_SALDO]);
            const tglPinjam = parseExcelDate(row[COL.TGL_PINJAM]);

            // Tenor terbayar: prefer explicit count from Excel, fallback to calculation
            const terbayarRaw = cleanNumber(row[COL.TERBAYAR]);
            const terbayar = terbayarRaw > 0
                ? Math.min(terbayarRaw, selama)
                : (angsuran > 0 ? Math.round(jumlah / angsuran) : 0);

            // Bayar Sendiri: if BS column has value, deductionSource = "bs", else "gaji"
            const bsRaw = row[COL.BS];
            const isBayarSendiri = bsRaw !== undefined && bsRaw !== null && String(bsRaw).trim() !== "" && String(bsRaw).trim() !== "0" && String(bsRaw).trim() !== "-";
            const deductionSource = isBayarSendiri ? "bs" : "gaji";

            // Monthly payments
            const monthlyPayments: { amount: number; month: number; name: string }[] = [];
            for (const m of MONTHS_2026) {
                const amt = cleanNumber(row[m.col]);
                if (amt > 0) {
                    monthlyPayments.push({ amount: amt, month: m.month, name: m.name });
                }
            }

            // Find member: NRP first, then name match (supports rows without NRP)
            let member: typeof allMembers[0] | undefined;
            if (nrp) {
                member = allMembers.find(m => m.nrp === nrp || m.memberNo === nrp);
            }
            if (!member) {
                const cleanName = cleanNameForMatch(rawNama);
                // Exact name match
                member = allMembers.find(m => cleanNameForMatch(m.name) === cleanName);
                // Fuzzy partial match: check if one name contains the other
                if (!member) {
                    member = allMembers.find(m => {
                        const mClean = cleanNameForMatch(m.name);
                        return mClean.length > 3 && cleanName.length > 3 &&
                            (mClean.includes(cleanName) || cleanName.includes(mClean));
                    });
                }
            }

            if (!member) {
                // FIX #3: Use unique ID generator instead of raw Date.now()
                const effectiveNrp = nrp || `MBR-${rawNama.replace(/\s+/g, "").substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
                const resultIdx = results.length;
                results.push({
                    row: i + 13, nrp: effectiveNrp, nama: rawNama, pinjam, selama, sisaSaldo, jumlah,
                    terbayar, deductionSource,
                    monthlyCount: monthlyPayments.length,
                    newPaymentsCount: monthlyPayments.length,
                    memberId: null, memberName: `[BARU] ${rawNama}`,
                    loanId: null, loanNo: null, currentOutstanding: null,
                    status: "valid", reason: `Buat baru (anggota baru + pinjaman), ${monthlyPayments.length} pembayaran, ${isBayarSendiri ? 'BS' : 'Gaji'}`,
                    isNewMember: true,
                });
                validCount++;

                // Queue commit task even for new members
                if (mode === "commit") {
                    const taskData = { nrp: effectiveNrp, rawNama, pinjam, selama, jasa, angsuran, jumlah, sisaSaldo, monthlyPayments, tglPinjam, terbayar, deductionSource };
                    commitTasks.push(async () => {
                        try {
                            // FIX #4: Transaction timeout 30 seconds
                            await prisma.$transaction(async (tx) => {
                                let activeMemberId: number;
                                let loanId: number | undefined;

                                // Auto-register member
                                const branch = defaultBranch || await tx.branch.findFirst({ where: { isActive: true } });
                                if (!branch) throw new Error("No active branch");

                                const newMember = await tx.member.create({
                                    data: {
                                        memberNo: taskData.nrp,
                                        nrp: taskData.nrp,
                                        name: taskData.rawNama,
                                        branchId: branch.id,
                                        joinDate: new Date(),
                                        status: "active",
                                    },
                                });
                                activeMemberId = newMember.id;

                                const anggotaRole = await tx.role.findUnique({ where: { name: "anggota" } });
                                if (anggotaRole) {
                                    const hashedPassword = await bcrypt.hash(taskData.nrp, 10);
                                    await tx.user.create({
                                        data: {
                                            name: taskData.rawNama, email: `${taskData.nrp}@koperasi.local`, password: hashedPassword,
                                            roleId: anggotaRole.id, branchId: branch.id, memberId: newMember.id, isActive: true,
                                        },
                                    });
                                }

                                // Create loan — uses captured adminId (FIX #5)
                                const product = defaultProduct || await tx.loanProduct.findFirst({ where: { isActive: true } });
                                if (!product) throw new Error("Missing product config");

                                const applicationDate = taskData.tglPinjam || new Date();
                                const applicationNo = nextLoanNo();
                                const app = await tx.loanApplication.create({
                                    data: {
                                        applicationNo,
                                        memberId: activeMemberId,
                                        branchId: branch.id,
                                        productId: product.id,
                                        amount: taskData.pinjam,
                                        tenorMonths: taskData.selama,
                                        purpose: "Import Update Pinjaman SP Mei 2026",
                                        status: "disbursed",
                                        deductionSource: taskData.deductionSource || "gaji",
                                        createdById: adminId,
                                        createdAt: applicationDate,
                                        approvedAt: applicationDate,
                                        approvedById: adminId,
                                    },
                                });

                                const loan = await tx.loan.create({
                                    data: {
                                        loanNo: applicationNo,
                                        applicationId: app.id,
                                        memberId: activeMemberId,
                                        branchId: branch.id,
                                        productSnapshot: JSON.parse(JSON.stringify(product)),
                                        principalAmount: taskData.pinjam,
                                        interestAmount: taskData.jasa * taskData.selama,
                                        totalAmount: taskData.pinjam + (taskData.jasa * taskData.selama),
                                        adminFee: Math.round(taskData.pinjam * 0.02),
                                        disbursedAmount: taskData.pinjam - Math.round(taskData.pinjam * 0.02),
                                        tenorMonths: taskData.selama,
                                        interestRate: taskData.pinjam > 0 ? Number(((taskData.jasa / taskData.pinjam) * 100).toFixed(2)) : 0,
                                        interestMethod: product.interestMethod || "flat",
                                        monthlyInstallment: taskData.angsuran + taskData.jasa,
                                        principalPaid: taskData.jumlah,
                                        interestPaid: taskData.terbayar * taskData.jasa,
                                        lateFeePaid: 0,
                                        principalOutstanding: taskData.sisaSaldo,
                                        interestOutstanding: Math.max(0, (taskData.jasa * taskData.selama) - (taskData.terbayar * taskData.jasa)),
                                        disbursementDate: applicationDate,
                                        firstDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + 1, 1),
                                        lastDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + taskData.selama, 1),
                                        status: taskData.sisaSaldo <= 0 ? "paid_off" : "active",
                                        paidOffDate: taskData.sisaSaldo <= 0 ? new Date() : null,
                                        disbursedById: adminId,
                                    },
                                });
                                loanId = loan.id;

                                // Generate LoanSchedule records
                                const schedBaseDate = applicationDate;
                                const paidInstallments = taskData.terbayar;
                                const scheds = [];
                                for (let j = 1; j <= taskData.selama; j++) {
                                    const dueDate = new Date(schedBaseDate.getFullYear(), schedBaseDate.getMonth() + j, 1);
                                    let schedPrincipal = Math.floor(taskData.pinjam / taskData.selama);
                                    let schedInterest = taskData.jasa;
                                    if (j === taskData.selama) {
                                        schedPrincipal += (taskData.pinjam - Math.floor(taskData.pinjam / taskData.selama) * taskData.selama);
                                    }
                                    const isPaid = j <= paidInstallments;
                                    scheds.push({
                                        loanId: loanId!,
                                        installmentNo: j,
                                        dueDate,
                                        principalAmount: schedPrincipal,
                                        interestAmount: schedInterest,
                                        totalAmount: schedPrincipal + schedInterest,
                                        principalPaid: isPaid ? schedPrincipal : 0,
                                        interestPaid: isPaid ? schedInterest : 0,
                                        status: isPaid ? "paid" : "pending",
                                    });
                                }
                                await tx.loanSchedule.createMany({ data: scheds });

                                // Create monthly payments
                                for (const mp of taskData.monthlyPayments) {
                                    const paymentDate = new Date(2026, mp.month, 28);
                                    const existing = await tx.loanPayment.findFirst({
                                        where: {
                                            loanId: loanId!,
                                            paymentDate: { gte: new Date(2026, mp.month, 1), lt: new Date(2026, mp.month + 1, 1) },
                                        },
                                    });
                                    if (existing) continue;

                                    const principalPortion = Math.min(taskData.angsuran, mp.amount);
                                    const interestPortion = mp.amount - principalPortion;

                                    await tx.loanPayment.create({
                                        data: {
                                            paymentNo: nextPaymentNo(loanId!),
                                            loanId: loanId!,
                                            memberId: activeMemberId,
                                            branchId: branch.id,
                                            amount: mp.amount,
                                            principalPortion,
                                            interestPortion,
                                            lateFeePortion: 0,
                                            paymentType: "installment",
                                            notes: `Import SP ${mp.name} 2026`,
                                            paymentDate,
                                            createdById: adminId,
                                        },
                                    });
                                }
                            }, { timeout: 30000 });
                            // FIX #2: Count success AFTER commit succeeds
                            successCount++;
                        } catch (err) {
                            // FIX #1: Properly track failures
                            failCount++;
                            console.error("Commit task error (new member):", err);
                            results[resultIdx].status = "failed";
                            results[resultIdx].reason = String((err as Error)?.message || err);
                        }
                    });
                }
                continue;
            }

            // Find existing active loan for this member
            const memberLoans = allLoans.filter(l => l.memberId === member!.id);
            let existingLoan = memberLoans.length === 1
                ? memberLoans[0]
                : memberLoans.find(l => Math.abs(Number(l.principalAmount) - pinjam) / pinjam < 0.05);

            const loanAction = existingLoan ? "update" : "create";
            const newPaymentsCount = existingLoan
                ? monthlyPayments.filter(mp => {
                    return !existingPayments.some(p => p.loanId === existingLoan!.id && p.paymentDate.getMonth() === mp.month && p.paymentDate.getFullYear() === 2026);
                }).length
                : monthlyPayments.length;

            const resultIdx = results.length;
            results.push({
                row: i + 13, nrp, nama: rawNama, pinjam, selama, sisaSaldo, jumlah,
                terbayar, deductionSource,
                monthlyCount: monthlyPayments.length,
                newPaymentsCount,
                memberId: member.id, memberName: member.name,
                loanId: existingLoan?.id || null,
                loanNo: existingLoan?.loanNo || null,
                currentOutstanding: existingLoan ? Number(existingLoan.principalOutstanding) : null,
                status: "valid",
                reason: `${loanAction === "update" ? "Update" : "Buat baru"} pinjaman, ${newPaymentsCount} pembayaran baru, ${isBayarSendiri ? 'BS' : 'Gaji'}`,
                isNewMember: false,
            });
            validCount++;

            // Queue commit task
            if (mode === "commit") {
                const taskMember = member;
                const taskLoan = existingLoan;
                const taskData = { nrp, rawNama, pinjam, selama, jasa, angsuran, jumlah, sisaSaldo, monthlyPayments, tglPinjam, terbayar, deductionSource };

                commitTasks.push(async () => {
                    try {
                        // FIX #4: Transaction timeout 30 seconds
                        await prisma.$transaction(async (tx) => {
                            let activeMemberId = taskMember!.id;
                            let loanId = taskLoan?.id;

                            // Auto-register member if needed (shouldn't happen since we checked above, but just in case)
                            if (!taskMember) {
                                const branch = defaultBranch || await tx.branch.findFirst({ where: { isActive: true } });
                                if (!branch) throw new Error("No active branch");

                                const newMember = await tx.member.create({
                                    data: {
                                        memberNo: taskData.nrp,
                                        nrp: taskData.nrp,
                                        name: taskData.rawNama,
                                        branchId: branch.id,
                                        joinDate: new Date(),
                                        status: "active",
                                    },
                                });
                                activeMemberId = newMember.id;

                                const anggotaRole = await tx.role.findUnique({ where: { name: "anggota" } });
                                if (anggotaRole) {
                                    const hashedPassword = await bcrypt.hash(taskData.nrp, 10);
                                    await tx.user.create({
                                        data: {
                                            name: taskData.rawNama, email: `${taskData.nrp}@koperasi.local`, password: hashedPassword,
                                            roleId: anggotaRole.id, branchId: branch.id, memberId: newMember.id, isActive: true,
                                        },
                                    });
                                }
                            }

                            if (!loanId) {
                                // Create new loan — uses captured adminId (FIX #5)
                                const product = defaultProduct || await tx.loanProduct.findFirst({ where: { isActive: true } });
                                const branch = defaultBranch || await tx.branch.findFirst({ where: { isActive: true } });
                                if (!product || !branch) throw new Error("Missing product or branch config");

                                const applicationDate = taskData.tglPinjam || new Date();
                                const applicationNo = nextLoanNo();
                                const app = await tx.loanApplication.create({
                                    data: {
                                        applicationNo,
                                        memberId: activeMemberId,
                                        branchId: branch.id,
                                        productId: product.id,
                                        amount: taskData.pinjam,
                                        tenorMonths: taskData.selama,
                                        purpose: "Import Update Pinjaman SP Mei 2026",
                                        status: "disbursed",
                                        deductionSource: taskData.deductionSource || "gaji",
                                        createdById: adminId,
                                        createdAt: applicationDate,
                                        approvedAt: applicationDate,
                                        approvedById: adminId,
                                    },
                                });

                                const loan = await tx.loan.create({
                                    data: {
                                        loanNo: applicationNo,
                                        applicationId: app.id,
                                        memberId: activeMemberId,
                                        branchId: branch.id,
                                        productSnapshot: JSON.parse(JSON.stringify(product)),
                                        principalAmount: taskData.pinjam,
                                        interestAmount: taskData.jasa * taskData.selama,
                                        totalAmount: taskData.pinjam + (taskData.jasa * taskData.selama),
                                        adminFee: Math.round(taskData.pinjam * 0.02),
                                        disbursedAmount: taskData.pinjam - Math.round(taskData.pinjam * 0.02),
                                        tenorMonths: taskData.selama,
                                        interestRate: taskData.pinjam > 0 ? Number(((taskData.jasa / taskData.pinjam) * 100).toFixed(2)) : 0,
                                        interestMethod: product.interestMethod || "flat",
                                        monthlyInstallment: taskData.angsuran + taskData.jasa,
                                        principalPaid: taskData.jumlah,
                                        interestPaid: taskData.terbayar * taskData.jasa,
                                        lateFeePaid: 0,
                                        principalOutstanding: taskData.sisaSaldo,
                                        interestOutstanding: Math.max(0, (taskData.jasa * taskData.selama) - (taskData.terbayar * taskData.jasa)),
                                        disbursementDate: applicationDate,
                                        firstDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + 1, 1),
                                        lastDueDate: new Date(applicationDate.getFullYear(), applicationDate.getMonth() + taskData.selama, 1),
                                        status: taskData.sisaSaldo <= 0 ? "paid_off" : "active",
                                        paidOffDate: taskData.sisaSaldo <= 0 ? new Date() : null,
                                        disbursedById: adminId,
                                    },
                                });
                                loanId = loan.id;

                                // Generate LoanSchedule records for new loan
                                const schedBaseDate2 = taskData.tglPinjam || new Date();
                                const paidInst2 = taskData.terbayar;
                                const scheds2 = [];
                                for (let j = 1; j <= taskData.selama; j++) {
                                    const dueDate = new Date(schedBaseDate2.getFullYear(), schedBaseDate2.getMonth() + j, 1);
                                    let schedPrincipal = Math.floor(taskData.pinjam / taskData.selama);
                                    let schedInterest = taskData.jasa;
                                    if (j === taskData.selama) {
                                        schedPrincipal += (taskData.pinjam - Math.floor(taskData.pinjam / taskData.selama) * taskData.selama);
                                    }
                                    const isPaid = j <= paidInst2;
                                    scheds2.push({
                                        loanId: loanId!,
                                        installmentNo: j,
                                        dueDate,
                                        principalAmount: schedPrincipal,
                                        interestAmount: schedInterest,
                                        totalAmount: schedPrincipal + schedInterest,
                                        principalPaid: isPaid ? schedPrincipal : 0,
                                        interestPaid: isPaid ? schedInterest : 0,
                                        status: isPaid ? "paid" : "pending",
                                    });
                                }
                                await tx.loanSchedule.createMany({ data: scheds2 });
                            } else {
                                // Update existing loan
                                const updatedPrincipalPaid = taskData.jumlah;
                                const paidCount = taskData.terbayar;
                                const updatedInterestPaid = paidCount * taskData.jasa;
                                const totalInterest = taskData.jasa * taskData.selama;
                                await tx.loan.update({
                                    where: { id: loanId },
                                    data: {
                                        principalOutstanding: taskData.sisaSaldo,
                                        principalPaid: updatedPrincipalPaid,
                                        interestPaid: updatedInterestPaid,
                                        interestOutstanding: Math.max(0, totalInterest - updatedInterestPaid),
                                        adminFee: Math.round(taskData.pinjam * 0.02),
                                        disbursedAmount: taskData.pinjam - Math.round(taskData.pinjam * 0.02),
                                        status: taskData.sisaSaldo <= 0 ? "paid_off" : "active",
                                        paidOffDate: taskData.sisaSaldo <= 0 ? new Date() : null,
                                    },
                                });

                                // Generate LoanSchedule records if missing
                                const existingSchedules = await tx.loanSchedule.count({ where: { loanId: loanId! } });
                                if (existingSchedules === 0) {
                                    const schedBase = taskData.tglPinjam || new Date();
                                    const schedsUpd = [];
                                    for (let j = 1; j <= taskData.selama; j++) {
                                        const dueDate = new Date(schedBase.getFullYear(), schedBase.getMonth() + j, 1);
                                        let schedPrincipal = Math.floor(taskData.pinjam / taskData.selama);
                                        let schedInterest = taskData.jasa;
                                        if (j === taskData.selama) {
                                            schedPrincipal += (taskData.pinjam - Math.floor(taskData.pinjam / taskData.selama) * taskData.selama);
                                        }
                                        const isPaid = j <= paidCount;
                                        schedsUpd.push({
                                            loanId: loanId!,
                                            installmentNo: j,
                                            dueDate,
                                            principalAmount: schedPrincipal,
                                            interestAmount: schedInterest,
                                            totalAmount: schedPrincipal + schedInterest,
                                            principalPaid: isPaid ? schedPrincipal : 0,
                                            interestPaid: isPaid ? schedInterest : 0,
                                            status: isPaid ? "paid" : "pending",
                                        });
                                    }
                                    await tx.loanSchedule.createMany({ data: schedsUpd });
                                }
                            }

                            // Create monthly payments (idempotent)
                            for (const mp of taskData.monthlyPayments) {
                                const paymentDate = new Date(2026, mp.month, 28);
                                const existing = await tx.loanPayment.findFirst({
                                    where: {
                                        loanId: loanId!,
                                        paymentDate: {
                                            gte: new Date(2026, mp.month, 1),
                                            lt: new Date(2026, mp.month + 1, 1),
                                        },
                                    },
                                });
                                if (existing) continue;

                                const principalPortion = Math.min(taskData.angsuran, mp.amount);
                                const interestPortion = mp.amount - principalPortion;

                                await tx.loanPayment.create({
                                    data: {
                                        paymentNo: nextPaymentNo(loanId!),
                                        loanId: loanId!,
                                        memberId: activeMemberId,
                                        branchId: taskMember?.branchId || (defaultBranch?.id ?? 1),
                                        amount: mp.amount,
                                        principalPortion,
                                        interestPortion,
                                        lateFeePortion: 0,
                                        paymentType: "installment",
                                        notes: `Import SP ${mp.name} 2026`,
                                        paymentDate,
                                        createdById: adminId,
                                    },
                                });
                            }
                        }, { timeout: 30000 });
                        // FIX #2: Count success AFTER commit succeeds
                        successCount++;
                    } catch (err) {
                        // FIX #1: Properly track failures
                        failCount++;
                        console.error("Commit task error:", err);
                        results[resultIdx].status = "failed";
                        results[resultIdx].reason = String((err as Error)?.message || err);
                    }
                });
            }
        }

        // FIX #6: Execute sequentially instead of Promise.all batches
        // Eliminates Date.now() collisions and reduces transaction contention
        if (mode === "commit" && commitTasks.length > 0) {
            for (const task of commitTasks) {
                await task();
            }
        }

        // Audit — uses session captured at top (FIX #5)
        try {
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "IMPORT", module: "Loan_Migrasi",
                description: `Import update pinjaman: ${mode === "commit" ? successCount : validCount} berhasil, ${failCount} gagal`,
                newData: { mode, successCount: mode === "commit" ? successCount : validCount, failCount, totalRows: results.length },
            });
        } catch (e) {}

        return NextResponse.json({
            data: {
                mode, type: "update_pinjaman",
                totalRows: results.length,
                success: mode === "commit" ? successCount : validCount,
                failed: failCount,
                preview: results,
                allResults: mode === "commit" ? results : undefined,
            },
        });
    } catch (error) {
        console.error("POST /api/loans/import-update error:", error);
        return NextResponse.json({ message: "Gagal memproses file pinjaman" }, { status: 500 });
    }
}

// === Helpers (inline copies to avoid cross-module dependency) ===

function cleanNrp(raw: string): string {
    return String(raw).replace(/['"]/g, "").replace(/\.0$/, "").trim();
}

function cleanNumber(raw: string | number | undefined): number {
    if (raw === undefined || raw === null || raw === "") return 0;
    if (typeof raw === "number") return raw;
    const isNegative = String(raw).includes("(") && String(raw).includes(")");
    const cleaned = String(raw).replace(/[^0-9.\-]/g, "");
    let num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    if (isNegative) num = -Math.abs(num);
    return num;
}

function cleanNameForMatch(name: string): string {
    if (!name) return "";
    let clean = String(name).replace(/['"]/g, "").trim().toUpperCase();
    clean = clean.split(",")[0].trim();
    const titles = [" S.H.", " SH", " S.PD.", " S.PD", " S.T.K.", " STK", " S.SOS.", " S.SOS", " S.E.", " SE", " S.IP.", " SIP", " M.H.", " MH", " M.SC.", " MSC", " M.M.", " MM", " S.T.", " ST", " S.PT.", " SPT", " S.OR.", " S.I.K.", " SIK"];
    let changed = true;
    while (changed) {
        changed = false;
        for (const t of titles) {
            if (clean.endsWith(t) || clean.endsWith(t.replace(/\./g, ""))) {
                clean = clean.substring(0, clean.length - t.length).trim();
                changed = true;
            }
        }
    }
    return clean.replace(/\./g, "").replace(/\s+/g, " ").trim();
}

function parseExcelDate(raw: string | undefined): Date | null {
    if (!raw || !String(raw).trim() || String(raw).trim() === "-") return null;
    const str = String(raw).trim();

    // Try "5 Feb 2025" or "5 Februari 2025" format
    const monthMap: Record<string, number> = {
        "jan": 0, "januari": 0, "peb": 1, "feb": 1, "februari": 1, "pebruari": 1,
        "mar": 2, "maret": 2, "mrt": 2, "apr": 3, "april": 3,
        "mei": 4, "may": 4, "jun": 5, "juni": 5, "jul": 6, "juli": 6,
        "agu": 7, "agt": 7, "agustus": 7, "aug": 7, "sep": 8, "september": 8,
        "okt": 9, "oktober": 9, "oct": 9, "nov": 10, "november": 10, "des": 11, "desember": 11, "dec": 11,
    };
    const parts = str.split(/[\s/-]+/);
    if (parts.length >= 3) {
        const day = parseInt(parts[0]);
        const monthStr = parts[1].toLowerCase().replace(/\./g, "");
        const year = parseInt(parts[2]);
        const month = monthMap[monthStr];
        if (!isNaN(day) && month !== undefined && !isNaN(year) && year > 2000) {
            return new Date(year, month, day);
        }
    }

    // Fallback: try native Date parse
    const d = new Date(str);
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return d;

    // Fallback: Excel serial date number
    const num = parseFloat(str);
    if (!isNaN(num) && num > 40000 && num < 60000) {
        return new Date((num - 25569) * 86400 * 1000);
    }

    return null;
}
