import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import {
  applyLoanEdit,
  LoanEditValidationError,
} from "@/lib/services/loan-edit";

// Fase 8b T3 — Mobile loan detail (GET) + edit (PUT).
// GET is a read (gate operator/admin/admin_sp — matches other mobile loan reads).
// PUT is the edit entry-point: gate operator/admin_sp (NOT admin/kasir — matches
// web PUT) + canAccessBranch(.allowed) pre-fetch gate. Both delegate the heavy
// lifting to the shared `applyLoanEdit` orchestrator (Fase 8b T2), which the web
// PUT also uses — so mobile and web stay byte-identical on the money-critical path.

interface Params {
  params: Promise<{ id: string }>;
}

// GET /api/mobile/loans/[id] — Loan detail (for the edit form's pre-fill).
// Returns the 7 editable fields + loanNo/status/branchId (Decimal → Number).
export async function GET(request: Request, { params }: Params) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();

  // Read gate — matches other mobile loan reads (operator/admin/admin_sp).
  if (
    user.role !== "operator" &&
    user.role !== "admin" &&
    user.role !== "admin_sp"
  ) {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { id } = await params;
    const loanId = parseInt(id);
    if (isNaN(loanId)) {
      return NextResponse.json(
        { message: "ID pinjaman tidak valid" },
        { status: 400 },
      );
    }

    const loan = await prisma.loan.findUnique({
      where: { id: loanId },
      select: {
        id: true,
        loanNo: true,
        status: true,
        branchId: true,
        // 7 editable fields (mirror applyLoanEdit's editable set)
        principalAmount: true,
        tenorMonths: true,
        interestRate: true,
        principalPaid: true,
        interestPaid: true,
        disbursementDate: true,
        firstDueDate: true,
      },
    });

    if (!loan) {
      return NextResponse.json(
        { message: "Pinjaman tidak ditemukan" },
        { status: 404 },
      );
    }

    // Convert Decimals → Number for the mobile payload.
    const data = {
      ...loan,
      principalAmount: Number(loan.principalAmount),
      interestRate: Number(loan.interestRate),
      principalPaid: Number(loan.principalPaid),
      interestPaid: Number(loan.interestPaid),
    };

    return NextResponse.json({ data });
  } catch (error) {
    console.error("GET /api/mobile/loans/[id] error:", error);
    return NextResponse.json(
      { message: "Gagal memuat detail pinjaman" },
      { status: 500 },
    );
  }
}

// PUT /api/mobile/loans/[id] — Edit pinjaman (operator/admin_sp only).
// Pre-fetch handles 404 (missing) + 403 (cross-branch) BEFORE applyLoanEdit;
// applyLoanEdit then handles not-active + numeric validation
// (→ LoanEditValidationError → 400). Mobile does its OWN audit (auditLog.create).
export async function PUT(request: Request, { params }: Params) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();

  // Write gate — stricter than GET: operator/admin_sp only (matches web PUT).
  if (user.role !== "operator" && user.role !== "admin_sp") {
    return NextResponse.json(
      { message: "Hanya Operator/Admin SP yang diizinkan mengedit pinjaman." },
      { status: 403 },
    );
  }

  try {
    const { id } = await params;
    const loanId = parseInt(id);
    if (isNaN(loanId)) {
      return NextResponse.json(
        { message: "ID pinjaman tidak valid" },
        { status: 400 },
      );
    }

    // Branch scope (mobile stricter than web): lightweight pre-fetch for the
    // gate. applyLoanEdit re-fetches authoritatively (branchId stable → no
    // real TOCTOU). Operator bypasses; non-operator fail-closed 403.
    const existing = await prisma.loan.findUnique({
      where: { id: loanId },
      select: { id: true, branchId: true, status: true },
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Pinjaman tidak ditemukan" },
        { status: 404 },
      );
    }
    if (!canAccessBranch(user, existing.branchId).allowed) {
      return NextResponse.json(
        { message: "Akses ditolak: pinjaman di luar scope branch Anda." },
        { status: 403 },
      );
    }

    // Delegate fetch → eligibility → validate → recalc → $transaction to the
    // shared helper (Fase 8b T2). Throws LoanEditValidationError for the 6
    // numeric guards + status-active + date-validity; we map it → HTTP 400.
    const body = await request.json();
    const { updatedLoan, changes } = await applyLoanEdit({
      loanId,
      body,
      userId: Number(user.id),
    });

    // Mobile owns its own audit (web uses logAuditFromRequest; mobile uses a
    // direct auditLog.create — Fase 7a pattern).
    await prisma.auditLog.create({
      data: {
        action: "UPDATE",
        module: "Pinjaman",
        description: `Pinjaman diedit via Mobile. Changes: ${changes.join(", ")}`,
        userId: Number(user.id),
        userName: user.name,
        userRole: user.role,
        status: "success",
      },
    });

    return NextResponse.json({
      data: updatedLoan,
      message: `Pinjaman berhasil di-edit. Jadwal angsuran telah di-regenerasi.`,
      changes,
    });
  } catch (err) {
    // Business-rule violations from applyLoanEdit → 400
    if (err instanceof LoanEditValidationError) {
      return NextResponse.json(
        { message: err.statusMessage },
        { status: 400 },
      );
    }
    console.error("PUT /api/mobile/loans/[id] error:", err);
    return NextResponse.json(
      { message: "Gagal mengedit pinjaman" },
      { status: 500 },
    );
  }
}
