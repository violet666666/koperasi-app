import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMobileUserWithScope, unauthorizedResponse } from '../../middleware';

// GET /api/mobile/reports/sp-income?year=YYYY[&month=1-12]
// Detail pendapatan jasa Simpan Pinjam:
//   - LoanPayment (non-voided): jasa/bunga, penalti pelunasan dipercepat, denda
//   - Loan.adminFee (dana resiko) — dipotong saat pencairan, dihitung per disbursementDate
// Gate: operator OR admin_sp (SP-scoped report, sama dgn piutang-gabungan).

export async function GET(request: Request) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'operator' && user.role !== 'admin_sp') {
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 });
  }

  try {
    const url = new URL(request.url);
    const year = parseInt(url.searchParams.get('year') || '');
    const monthRaw = url.searchParams.get('month');
    const month = monthRaw ? parseInt(monthRaw) : null;

    if (isNaN(year) || year < 2000 || year > 2100) {
      return NextResponse.json({ message: 'Parameter year tidak valid' }, { status: 400 });
    }
    if (month !== null && (isNaN(month) || month < 1 || month > 12)) {
      return NextResponse.json({ message: 'Parameter month harus 1-12' }, { status: 400 });
    }

    const start = new Date(year, month ? month - 1 : 0, 1);
    const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

    const [payments, disbursements] = await Promise.all([
      prisma.loanPayment.findMany({
        where: {
          paymentDate: { gte: start, lt: end },
          status: { not: 'voided' },
        },
        select: {
          id: true, paymentNo: true, paymentDate: true, paymentType: true,
          interestPortion: true, earlySettlementFee: true, lateFeePortion: true,
          loan: { select: { loanNo: true, member: { select: { name: true } } } },
        },
        orderBy: { paymentDate: 'desc' },
      }),
      prisma.loan.findMany({
        where: {
          disbursementDate: { gte: start, lt: end },
          status: { in: ['active', 'paid_off'] },
          adminFee: { gt: 0 },
        },
        select: {
          id: true, loanNo: true, disbursementDate: true, adminFee: true,
          member: { select: { name: true } },
        },
        orderBy: { disbursementDate: 'desc' },
      }),
    ]);

    const jasa = payments.reduce((s, p) => s + Number(p.interestPortion || 0), 0);
    const penaltiPelunasan = payments.reduce((s, p) => s + Number(p.earlySettlementFee || 0), 0);
    const denda = payments.reduce((s, p) => s + Number(p.lateFeePortion || 0), 0);
    const danaResiko = disbursements.reduce((s, l) => s + Number(l.adminFee || 0), 0);

    return NextResponse.json({
      data: {
        period: { year, month },
        totals: {
          jasa,
          penaltiPelunasan,
          denda,
          danaResiko,
          total: jasa + penaltiPelunasan + denda + danaResiko,
        },
        payments: payments.map(p => ({
          id: p.id,
          paymentNo: p.paymentNo,
          paymentDate: p.paymentDate?.toISOString(),
          paymentType: p.paymentType,
          memberName: p.loan?.member?.name || '-',
          loanNo: p.loan?.loanNo || '-',
          jasa: Number(p.interestPortion || 0),
          penaltiPelunasan: Number(p.earlySettlementFee || 0),
          denda: Number(p.lateFeePortion || 0),
        })),
        disbursements: disbursements.map(l => ({
          id: l.id,
          loanNo: l.loanNo,
          disbursementDate: l.disbursementDate?.toISOString(),
          memberName: l.member?.name || '-',
          danaResiko: Number(l.adminFee || 0),
        })),
      },
    });
  } catch (error) {
    console.error('sp-income GET error:', error);
    return NextResponse.json({ message: 'Gagal memuat detail pendapatan Simpan Pinjam' }, { status: 500 });
  }
}
