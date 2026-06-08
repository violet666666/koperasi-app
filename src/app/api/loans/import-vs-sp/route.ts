import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import * as XLSX from "xlsx";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import {
  cleanNrp,
  cleanNumber,
  cleanNameForMatch,
  parseExcelDate,
  detectPeriod,
  COL,
  SUMMARY_KEYWORDS,
  ROMAWI,
  MONTH_INDONESIAN,
} from "@/lib/import-vs-sp-helpers";

// Allow up to 5 minutes for large imports
export const maxDuration = 300;

// =================================================================
// POST /api/loans/import-vs-sp
// Import VS SP loan data from GAJI sheet (single-period format)
// =================================================================
export async function POST(request: Request) {
  try {
    // ── Auth check ONCE at top ──────────────────────────────────
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const roleName =
      typeof session.user.role === "string"
        ? session.user.role
        : (session.user.role as Record<string, unknown>)?.name;
    if (roleName !== "operator") {
      return NextResponse.json(
        { message: "Hanya Operator yang dapat mengimport data pinjaman." },
        { status: 403 },
      );
    }
    const adminId = session.user.id ? Number(session.user.id) : 1;

    // ── Sequence number generators ──────────────────────────────
    const importDate = new Date();
    const importMonth = ROMAWI[importDate.getMonth()];
    const importYear = importDate.getFullYear();
    const loanPrefix = "SP-IMP/";
    const payPrefix = "PAY-IMP/";
    const monthYearSuffix = `/PRIM/${importMonth}/${importYear}`;

    const lastLoanApp = await prisma.loanApplication.findFirst({
      where: { applicationNo: { startsWith: loanPrefix } },
      orderBy: { applicationNo: "desc" },
      select: { applicationNo: true },
    });
    let loanSeq = 0;
    if (lastLoanApp) {
      const match = lastLoanApp.applicationNo.match(/SP-IMP\/(\d+)\//);
      if (match) loanSeq = parseInt(match[1], 10);
    }

    const lastPayment = await prisma.loanPayment.findFirst({
      where: { paymentNo: { startsWith: payPrefix } },
      orderBy: { paymentNo: "desc" },
      select: { paymentNo: true },
    });
    let paySeq = 0;
    if (lastPayment) {
      const match = lastPayment.paymentNo.match(/PAY-IMP\/(\d+)\//);
      if (match) paySeq = parseInt(match[1], 10);
    }

    const nextLoanNo = () => {
      loanSeq++;
      return `${loanPrefix}${String(loanSeq).padStart(4, "0")}${monthYearSuffix}`;
    };
    const nextPaymentNo = () => {
      paySeq++;
      return `${payPrefix}${String(paySeq).padStart(4, "0")}${monthYearSuffix}`;
    };

    // ── Parse FormData ──────────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const mode = (formData.get("mode") as string) || "preview";
    const sheetName = (formData.get("sheetName") as string) || "GAJI";
    const selectedRowsRaw = formData.get("selectedRows") as string | null;
    let selectedRows: number[] | null = null;
    if (selectedRowsRaw) {
      try {
        selectedRows = JSON.parse(selectedRowsRaw) as number[];
      } catch {
        selectedRows = null;
      }
    }

    if (!file) {
      return NextResponse.json({ message: "File wajib diupload" }, { status: 400 });
    }

    // ── Read Excel ──────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const workbook = XLSX.read(buffer, { type: "buffer" });

    const resolvedSheetName =
      workbook.SheetNames.find((s) => s === sheetName) || workbook.SheetNames[0];
    const worksheet = workbook.Sheets[resolvedSheetName];

    let rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: false,
      defval: "",
    }) as string[][];

    rows = rows.filter((row) => row.some((cell) => cell && String(cell).trim() !== ""));

    if (rows.length === 0) {
      return NextResponse.json({ message: "File kosong" }, { status: 400 });
    }

    // ── Detect period from header rows ──────────────────────────
    const period = detectPeriod(rows);
    if (!period) {
      return NextResponse.json(
        { message: "Tidak dapat mendeteksi periode dari header sheet. Pastikan ada 'PER [tgl] [Bulan] [Tahun]' di header." },
        { status: 400 },
      );
    }

    // ── Load reference data ─────────────────────────────────────
    const allMembers = await prisma.member.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, nrp: true, memberNo: true, branchId: true },
    });

    const allLoans = await prisma.loan.findMany({
      where: { status: "active" },
      select: {
        id: true,
        loanNo: true,
        memberId: true,
        principalAmount: true,
        principalPaid: true,
        principalOutstanding: true,
        interestOutstanding: true,
        tenorMonths: true,
        branchId: true,
        disbursementDate: true,
      },
    });

    // Load existing payments for the detected month
    const periodMonth0 = period.monthNum - 1; // 0-based for JS Date
    const paymentDateStart = new Date(period.year, periodMonth0, 1);
    const paymentDateEnd = new Date(period.year, periodMonth0 + 1, 1);
    const existingPayments = await prisma.loanPayment.findMany({
      where: {
        paymentDate: { gte: paymentDateStart, lt: paymentDateEnd },
      },
      select: { loanId: true, paymentDate: true, amount: true },
    });

    const defaultProduct = await prisma.loanProduct.findFirst({ where: { isActive: true } });
    const defaultBranch =
      (await prisma.branch.findFirst({ where: { isHeadOffice: true, isActive: true } })) ||
      (await prisma.branch.findFirst({ where: { isActive: true } }));

    // ── Parse data rows ─────────────────────────────────────────
    const DATA_START_ROW = 12;
    const dataRows = rows.slice(DATA_START_ROW);

    interface ImportRow {
      row: number;
      nrp: string;
      nama: string;
      pangkat: string;
      pinjam: number;
      selama: number;
      jasa: number;
      angsuran: number;
      potBulan: number;
      totalBulan: number;
      jumlahSd: number;
      sisaSaldo: number;
      tglPinjam: Date | null;
      deductionSource: string;
      memberId: number | null;
      memberName: string;
      loanId: number | null;
      loanNo: string | null;
      currentOutstanding: number | null;
      monthlyCount: number;
      newPaymentsCount: number;
      status: "UPDATE" | "NEW_LOAN" | "NEW_MEMBER" | "SKIP_ZERO" | "ERROR" | "FAILED";
      reason: string;
      isNewMember: boolean;
    }

    const results: ImportRow[] = [];
    let validCount = 0;
    let successCount = 0;
    let failCount = 0;
    const commitTasks: (() => Promise<void>)[] = [];

    // Track IDs for batch record (only NEWLY created)
    const committedPaymentIds: number[] = [];
    const committedNewMemberIds: number[] = [];

    // Track snapshots for undo
    const preImportSnapshots: Record<string, unknown> = {};

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (row.length <= COL.SISA_SALDO) continue;

      const rawNama = String(row[COL.NAMA] || "").trim();
      const nrp = cleanNrp(row[COL.NRP]);

      // Skip empty names, header labels, numeric-only names
      if (!rawNama || rawNama.toUpperCase() === "NAMA" || rawNama === "0") continue;
      if (/^\d+(\.\d+)?$/.test(rawNama)) continue;

      // Skip summary keywords
      const upperNama = rawNama.toUpperCase();
      if (SUMMARY_KEYWORDS.some((kw) => upperNama.includes(kw))) continue;

      const pinjam = cleanNumber(row[COL.PINJAM]);
      if (pinjam <= 0) {
        // Record SKIP_ZERO rows for visibility in preview
        results.push({
          row: i + DATA_START_ROW + 1,
          nrp: nrp || "-",
          nama: rawNama,
          pangkat: String(row[COL.PANGKAT] || "").trim(),
          pinjam,
          selama: 0,
          jasa: 0,
          angsuran: 0,
          potBulan: 0,
          totalBulan: 0,
          jumlahSd: 0,
          sisaSaldo: 0,
          tglPinjam: null,
          deductionSource: "gaji",
          memberId: null,
          memberName: rawNama,
          loanId: null,
          loanNo: null,
          currentOutstanding: null,
          monthlyCount: 0,
          newPaymentsCount: 0,
          status: "SKIP_ZERO",
          reason: "Pinjaman ≤ 0, dilewati",
          isNewMember: false,
        });
        continue;
      }

      const selama = cleanNumber(row[COL.SELAMA]) || 12;
      const jasa = cleanNumber(row[COL.JASA]);
      const angsuran = cleanNumber(row[COL.ANGSURAN]) || Math.ceil(pinjam / selama);
      const potBulan = cleanNumber(row[COL.POT_BULAN]);
      const totalBulan = cleanNumber(row[COL.TOTAL_BULAN]);
      const jumlahSd = cleanNumber(row[COL.JUMLAH_SD]);
      const sisaSaldo = cleanNumber(row[COL.SISA_SALDO]);
      const pangkat = String(row[COL.PANGKAT] || "").trim();
      const tglPinjam = parseExcelDate(row[COL.TGL_PINJAM]);

      if (!nrp && !rawNama) continue;

      // ── Member matching: NRP → Name exact → Name fuzzy ─────
      let member: (typeof allMembers)[0] | undefined;
      if (nrp) {
        member = allMembers.find((m) => m.nrp === nrp || m.memberNo === nrp);
      }
      if (!member) {
        const cleanName = cleanNameForMatch(rawNama);
        member = allMembers.find((m) => cleanNameForMatch(m.name) === cleanName);
        if (!member) {
          member = allMembers.find((m) => {
            const mClean = cleanNameForMatch(m.name);
            return (
              mClean.length > 3 &&
              cleanName.length > 3 &&
              (mClean.includes(cleanName) || cleanName.includes(mClean))
            );
          });
        }
      }

      // ── Loan matching: Amount+Date → Amount only ────────────
      const memberLoans = member ? allLoans.filter((l) => l.memberId === member!.id) : [];
      let existingLoan: (typeof allLoans)[0] | undefined;

      if (memberLoans.length === 1) {
        existingLoan = memberLoans[0];
      } else if (memberLoans.length > 1) {
        // Strategy 1: Amount + Date match
        if (tglPinjam) {
          existingLoan = memberLoans.find((l) => {
            const amountMatch =
              Math.abs(Number(l.principalAmount) - pinjam) / pinjam < 0.01;
            const dateMatch =
              l.disbursementDate &&
              Math.abs(l.disbursementDate.getTime() - tglPinjam.getTime()) <
                30 * 24 * 60 * 60 * 1000;
            return amountMatch && dateMatch;
          });
        }
        // Strategy 2: Amount only
        if (!existingLoan) {
          existingLoan = memberLoans.find(
            (l) => Math.abs(Number(l.principalAmount) - pinjam) / pinjam < 0.01,
          );
        }
      }

      // ── Determine action ─────────────────────────────────────
      const isNewMember = !member;
      const isNewLoan = !existingLoan;

      // Payment count for this row (single monthly deduction)
      const hasPayment = potBulan > 0;
      const newPaymentsCount = hasPayment
        ? existingLoan
          ? existingPayments.some(
              (p) =>
                p.loanId === existingLoan!.id &&
                p.paymentDate.getMonth() === periodMonth0 &&
                p.paymentDate.getFullYear() === period.year,
            )
            ? 0
            : 1
          : 1
        : 0;

      const deductionSource = "gaji"; // VS SP always salary deduction

      const resultIdx = results.length;
      results.push({
        row: i + DATA_START_ROW + 1,
        nrp: nrp || "-",
        nama: rawNama,
        pangkat,
        pinjam,
        selama,
        jasa,
        angsuran,
        potBulan,
        totalBulan,
        jumlahSd,
        sisaSaldo,
        tglPinjam,
        deductionSource,
        memberId: member?.id ?? null,
        memberName: member?.name ?? `[BARU] ${rawNama}`,
        loanId: existingLoan?.id ?? null,
        loanNo: existingLoan?.loanNo ?? null,
        currentOutstanding: existingLoan ? Number(existingLoan.principalOutstanding) : null,
        monthlyCount: hasPayment ? 1 : 0,
        newPaymentsCount,
        status: isNewMember
          ? "NEW_MEMBER"
          : isNewLoan
            ? "NEW_LOAN"
            : "UPDATE",
        reason: isNewMember
          ? `Buat baru (anggota baru + pinjaman), ${hasPayment ? "1 pembayaran" : "tanpa pembayaran"}`
          : isNewLoan
            ? `Buat pinjaman baru, ${hasPayment ? "1 pembayaran" : "tanpa pembayaran"}`
            : `Update pinjaman, ${newPaymentsCount} pembayaran baru`,
        isNewMember,
      });
      validCount++;

      // ── Filter by selectedRows if provided ────────────────────
      if (selectedRows && !selectedRows.includes(resultIdx)) continue;

      // ── Queue commit task ─────────────────────────────────────
      if (mode === "commit") {
        const taskMember = member;
        const taskLoan = existingLoan;
        const taskData = {
          nrp,
          rawNama,
          pangkat,
          pinjam,
          selama,
          jasa,
          angsuran,
          potBulan,
          totalBulan,
          jumlahSd,
          sisaSaldo,
          tglPinjam,
          deductionSource,
        };

        commitTasks.push(async () => {
          try {
            await prisma.$transaction(
              async (tx) => {
                let activeMemberId: number;
                let loanId: number | undefined;

                // ── Auto-register member if needed ────────────────
                if (!taskMember) {
                  const effectiveNrp =
                    taskData.nrp ||
                    `MBR-${taskData.rawNama.replace(/\s+/g, "").substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

                  const branch =
                    defaultBranch || (await tx.branch.findFirst({ where: { isActive: true } }));
                  if (!branch) throw new Error("No active branch");

                  const newMember = await tx.member.create({
                    data: {
                      memberNo: effectiveNrp,
                      nrp: effectiveNrp,
                      name: taskData.rawNama,
                      pangkat: taskData.pangkat || null,
                      branchId: branch.id,
                      joinDate: new Date(),
                      status: "active",
                    },
                  });
                  activeMemberId = newMember.id;
                  committedNewMemberIds.push(newMember.id);

                  const anggotaRole = await tx.role.findUnique({ where: { name: "anggota" } });
                  if (anggotaRole) {
                    const hashedPassword = await bcrypt.hash(effectiveNrp, 10);
                    await tx.user.create({
                      data: {
                        name: taskData.rawNama,
                        email: `${effectiveNrp}@koperasi.local`,
                        password: hashedPassword,
                        roleId: anggotaRole.id,
                        branchId: branch.id,
                        memberId: newMember.id,
                        isActive: true,
                      },
                    });
                  }
                } else {
                  activeMemberId = taskMember.id;
                }

                // ── Create or update loan ──────────────────────────
                if (!taskLoan) {
                  // Create new loan
                  const product =
                    defaultProduct ||
                    (await tx.loanProduct.findFirst({ where: { isActive: true } }));
                  if (!product) throw new Error("Missing product config");

                  const branch =
                    defaultBranch ||
                    taskMember?.branchId
                      ? { id: taskMember?.branchId ?? defaultBranch?.id ?? 1 }
                      : await tx.branch.findFirst({ where: { isActive: true } });
                  if (!branch) throw new Error("No active branch");

                  const applicationDate = taskData.tglPinjam || new Date();
                  const applicationNo = nextLoanNo();
                  const totalInterest = taskData.jasa * taskData.selama;
                  const schedPrincipal = Math.floor(taskData.pinjam / taskData.selama);

                  const app = await tx.loanApplication.create({
                    data: {
                      applicationNo,
                      memberId: activeMemberId,
                      branchId: branch.id,
                      productId: product.id,
                      amount: taskData.pinjam,
                      tenorMonths: taskData.selama,
                      purpose: `Import VS SP ${period.monthName} ${period.year}`,
                      status: "disbursed",
                      deductionSource: taskData.deductionSource,
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
                      interestAmount: totalInterest,
                      totalAmount: taskData.pinjam + totalInterest,
                      adminFee: Math.round(taskData.pinjam * 0.02),
                      disbursedAmount: taskData.pinjam - Math.round(taskData.pinjam * 0.02),
                      tenorMonths: taskData.selama,
                      interestRate:
                        taskData.pinjam > 0
                          ? Number(((taskData.jasa / taskData.pinjam) * 100).toFixed(2))
                          : 0,
                      interestMethod: product.interestMethod || "flat",
                      monthlyInstallment: schedPrincipal + taskData.jasa,
                      principalPaid: taskData.jumlahSd,
                      interestPaid:
                        taskData.angsuran + taskData.jasa > 0
                          ? Math.round(
                              taskData.jumlahSd *
                                (taskData.jasa / (taskData.angsuran + taskData.jasa)),
                            )
                          : taskData.totalBulan * taskData.jasa,
                      lateFeePaid: 0,
                      principalOutstanding: taskData.sisaSaldo,
                      interestOutstanding: Math.max(
                        0,
                        totalInterest - taskData.totalBulan * taskData.jasa,
                      ),
                      disbursementDate: applicationDate,
                      firstDueDate: new Date(
                        applicationDate.getFullYear(),
                        applicationDate.getMonth() + 1,
                        1,
                      ),
                      lastDueDate: new Date(
                        applicationDate.getFullYear(),
                        applicationDate.getMonth() + taskData.selama,
                        1,
                      ),
                      // Guard: only mark paid_off if sisaSaldo ≤ 0 AND some payments exist.
                      // Prevents empty Excel SISA_SALDO (→ cleanNumber → 0) from falsely
                      // marking a never-paid loan as LUNAS.
                      status: (taskData.sisaSaldo <= 0 && (taskData.jumlahSd > 0 || taskData.totalBulan >= taskData.selama)) ? "paid_off" : "active",
                      paidOffDate: (taskData.sisaSaldo <= 0 && (taskData.jumlahSd > 0 || taskData.totalBulan >= taskData.selama)) ? new Date() : null,
                      disbursedById: adminId,
                    },
                  });
                  loanId = loan.id;

                  // Generate schedule
                  const paidInstallments = taskData.totalBulan;
                  const scheds = [];
                  for (let j = 1; j <= taskData.selama; j++) {
                    const dueDate = new Date(
                      applicationDate.getFullYear(),
                      applicationDate.getMonth() + j,
                      1,
                    );
                    let sp = Math.floor(taskData.pinjam / taskData.selama);
                    const si = taskData.jasa;
                    if (j === taskData.selama) {
                      sp += taskData.pinjam - Math.floor(taskData.pinjam / taskData.selama) * taskData.selama;
                    }
                    const isPaid = j <= paidInstallments;
                    scheds.push({
                      loanId: loanId!,
                      installmentNo: j,
                      dueDate,
                      principalAmount: sp,
                      interestAmount: si,
                      totalAmount: sp + si,
                      principalPaid: isPaid ? sp : 0,
                      interestPaid: isPaid ? si : 0,
                      status: isPaid ? "paid" : "pending",
                    });
                  }
                  await tx.loanSchedule.createMany({ data: scheds });
                } else {
                  // Update existing loan — snapshot before changes
                  const existingData = await tx.loan.findUnique({
                    where: { id: taskLoan.id },
                    select: {
                      principalAmount: true,
                      principalPaid: true,
                      principalOutstanding: true,
                      tenorMonths: true,
                      monthlyInstallment: true,
                    },
                  });
                  if (existingData) {
                    preImportSnapshots[`loan_${taskLoan.id}`] = existingData;
                  }

                  // Update loan fields
                  const totalInterest = taskData.jasa * taskData.selama;
                  const paidCount = taskData.totalBulan;
                  const updatedInterestPaid =
                    taskData.angsuran + taskData.jasa > 0
                      ? Math.round(
                          taskData.jumlahSd *
                            (taskData.jasa / (taskData.angsuran + taskData.jasa)),
                        )
                      : paidCount * taskData.jasa;
                  const schedPrincipal = Math.floor(taskData.pinjam / taskData.selama);
                  const applicationDate = taskData.tglPinjam || new Date();

                  await tx.loan.update({
                    where: { id: taskLoan.id },
                    data: {
                      principalAmount: taskData.pinjam,
                      interestAmount: totalInterest,
                      totalAmount: taskData.pinjam + totalInterest,
                      tenorMonths: taskData.selama,
                      interestRate:
                        taskData.pinjam > 0
                          ? Number(((taskData.jasa / taskData.pinjam) * 100).toFixed(2))
                          : 0,
                      monthlyInstallment: schedPrincipal + taskData.jasa,
                      adminFee: Math.round(taskData.pinjam * 0.02),
                      disbursedAmount:
                        taskData.pinjam - Math.round(taskData.pinjam * 0.02),
                      principalPaid: taskData.jumlahSd,
                      interestPaid: updatedInterestPaid,
                      principalOutstanding: taskData.sisaSaldo,
                      interestOutstanding: Math.max(0, totalInterest - updatedInterestPaid),
                      disbursementDate: applicationDate,
                      firstDueDate: new Date(
                        applicationDate.getFullYear(),
                        applicationDate.getMonth() + 1,
                        1,
                      ),
                      lastDueDate: new Date(
                        applicationDate.getFullYear(),
                        applicationDate.getMonth() + taskData.selama,
                        1,
                      ),
                      // Guard: only mark paid_off if sisaSaldo ≤ 0 AND some payments exist
                      status: (taskData.sisaSaldo <= 0 && (taskData.jumlahSd > 0 || taskData.totalBulan >= taskData.selama)) ? "paid_off" : "active",
                      paidOffDate: (taskData.sisaSaldo <= 0 && (taskData.jumlahSd > 0 || taskData.totalBulan >= taskData.selama)) ? new Date() : null,
                    },
                  });

                  // Update schedules — update statuses (NOT delete+recreate)
                  const paidInst = taskData.totalBulan;
                  const allSchedules = await tx.loanSchedule.findMany({
                    where: { loanId: taskLoan.id },
                    orderBy: { installmentNo: "asc" },
                  });

                  for (const sched of allSchedules) {
                    const isPaid = sched.installmentNo <= paidInst;
                    const sp = Math.floor(taskData.pinjam / taskData.selama);
                    const si = taskData.jasa;
                    await tx.loanSchedule.update({
                      where: { id: sched.id },
                      data: {
                        status: isPaid ? "paid" : sched.status === "overdue" ? "overdue" : "pending",
                        principalPaid: isPaid ? sp : 0,
                        interestPaid: isPaid ? si : 0,
                      },
                    });
                  }

                  loanId = taskLoan.id;
                }

                // ── Create monthly payment (idempotent) ───────────
                if (taskData.potBulan > 0 && loanId) {
                  const paymentDate = new Date(period.year, periodMonth0, 28);

                  // Idempotency check
                  const existing = await tx.loanPayment.findFirst({
                    where: {
                      loanId: loanId!,
                      paymentDate: {
                        gte: paymentDateStart,
                        lt: paymentDateEnd,
                      },
                    },
                  });
                  if (!existing) {
                    const principalPortion = taskData.angsuran;
                    const interestPortion = taskData.jasa;

                    const payment = await tx.loanPayment.create({
                      data: {
                        paymentNo: nextPaymentNo(),
                        loanId: loanId!,
                        memberId: activeMemberId,
                        branchId:
                          taskMember?.branchId || defaultBranch?.id || 1,
                        amount: taskData.potBulan,
                        principalPortion,
                        interestPortion,
                        lateFeePortion: 0,
                        paymentType: "installment",
                        notes: `Import VS SP ${period.monthName} ${period.year}`,
                        paymentDate,
                        createdById: adminId,
                      },
                    });
                    committedPaymentIds.push(payment.id);
                  }
                }
              },
              { timeout: 30000 },
            );
            successCount++;
          } catch (err) {
            failCount++;
            console.error("Commit task error:", err);
            results[resultIdx].status = "FAILED";
            results[resultIdx].reason = String((err as Error)?.message || err);
          }
        });
      }
    }

    // ── Execute commit tasks in batches of 5 ────────────────────
    let batchId: number | undefined;
    let batchNo = "";
    if (mode === "commit" && commitTasks.length > 0) {
      const BATCH = 5;
      for (let i = 0; i < commitTasks.length; i += BATCH) {
        await Promise.all(commitTasks.slice(i, i + BATCH).map((fn) => fn()));
      }

      // ── Create ImportBatch record for undo ────────────────────
      try {
        // Generate batchNo in spec format: VS-SP/NNNN/PRIM/ROMAN_MONTH/YEAR
        const existingBatches = await prisma.importBatch.count({
          where: {
            type: "import_vs_sp",
            period: `${period.monthName} ${period.year}`,
          },
        });
        const batchSeq = existingBatches + 1;
        const romanMonth = ROMAWI[period.monthNum - 1];
        batchNo = `VS-SP/${String(batchSeq).padStart(4, "0")}/PRIM/${romanMonth}/${period.year}`;

        // Collect loan IDs from results (for both new and updated)
        const loanIds: number[] = [];
        for (const r of results) {
          if (r.loanId) loanIds.push(r.loanId);
        }

        const batch = await prisma.importBatch.create({
          data: {
            batchNo,
            type: "import_vs_sp",
            fileName: file.name,
            sheetName: resolvedSheetName,
            period: `${period.monthName} ${period.year}`,
            totalRows: results.length,
            successCount,
            errorCount: failCount,
            loanIds,
            paymentIds: committedPaymentIds,
            memberIds: committedNewMemberIds,
            preImportSnapshots: JSON.parse(JSON.stringify(preImportSnapshots)),
            createdById: adminId,
          },
        });
        batchId = batch.id;
      } catch (batchErr) {
        console.error("Failed to create ImportBatch record:", batchErr);
        // Non-fatal — import already succeeded
      }
    }

    // ── Audit log ───────────────────────────────────────────────
    try {
      const reqInfo = extractRequestInfo(request);
      const userInfo = extractUserFromSession(session);
      await logAudit({
        ...userInfo,
        ...reqInfo,
        action: "IMPORT",
        module: "Pinjaman",
        description: `Import VS SP ${period.monthName} ${period.year}: ${mode === "commit" ? successCount : validCount} berhasil, ${failCount} gagal`,
        newData: {
          mode,
          period: `${period.monthName} ${period.year}`,
          sheet: resolvedSheetName,
          successCount: mode === "commit" ? successCount : validCount,
          failCount,
          totalRows: results.length,
        },
      });
    } catch {
      // Non-fatal audit logging failure
    }

    // ── Build summary breakdown ───────────────────────────────────
    const summary = {
      total: results.length,
      update: results.filter((r) => r.status === "UPDATE").length,
      newLoan: results.filter((r) => r.status === "NEW_LOAN").length,
      newMember: results.filter((r) => r.status === "NEW_MEMBER").length,
      skip: results.filter((r) => r.status === "SKIP_ZERO").length,
      error: results.filter((r) => r.status === "ERROR").length,
    };

    const periodLabel = `${period.monthName.toUpperCase()} ${period.year}`;

    if (mode === "preview") {
      return NextResponse.json({
        period: periodLabel,
        periodInfo: { monthNum: period.monthNum, monthName: period.monthName, year: period.year },
        availableSheets: workbook.SheetNames,
        summary,
        rows: results,
      });
    }

    // Commit mode response
    return NextResponse.json({
      period: periodLabel,
      batchId: batchId ?? "",
      batchNo,
      imported: successCount,
      failed: failCount,
      summary,
      rows: results,
    });
  } catch (error) {
    console.error("POST /api/loans/import-vs-sp error:", error);
    return NextResponse.json(
      { message: "Gagal memproses file pinjaman" },
      { status: 500 },
    );
  }
}
