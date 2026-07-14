import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMobileUserWithScope, unauthorizedResponse } from '../../middleware';

// GET /api/mobile/billing/[periodId] — Billing period detail (Fase 9b READ-ONLY)
// Mirrors web /api/billing/[periodId] GET. No write/void/process.
// Gate: operator OR admin_sp (org-wide piutang — no branch scope).

interface Params { params: Promise<{ periodId: string }> }

export async function GET(request: Request, { params }: Params) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'operator' && user.role !== 'admin_sp') {
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 });
  }

  try {
    const { periodId } = await params;
    const id = parseInt(periodId);
    if (isNaN(id)) {
      return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });
    }

    const period = await prisma.billingPeriod.findUnique({
      where: { id },
      include: {
        billingItems: { orderBy: { memberId: 'asc' } },
        processedBy: { select: { name: true } },
      },
    });

    if (!period) {
      return NextResponse.json({ message: 'Period tidak ditemukan' }, { status: 404 });
    }

    const marked = period.billingItems.filter(i => i.isPaid).length;
    const unpaid = period.billingItems.filter(i => !i.isPaid).length;

    return NextResponse.json({
      data: {
        period: {
          id: period.id,
          periodStart: period.periodStart?.toISOString(),
          periodEnd: period.periodEnd?.toISOString(),
          periodLabel: period.periodLabel || `${period.periodStart?.getMonth()}/${period.periodStart?.getFullYear()}`,
          status: period.status,
          totalMembers: period.totalMembers ?? period.billingItems.length,
          totalAmount: Number(period.totalAmount ?? 0),
          processedBy: period.processedBy?.name || null,
          processedAt: period.processedAt?.toISOString() || null,
        },
        items: period.billingItems.map(item => ({
          id: item.id,
          memberId: item.memberId,
          memberName: item.memberName,
          unitType: item.unitType,
          amount: Number(item.amount),
          isPaid: item.isPaid,
          paidAt: item.paidAt?.toISOString(),
          paidById: item.paidById ?? null,
        })),
        stats: {
          total: period.billingItems.length,
          marked,
          unpaid,
        },
      },
    });
  } catch (error) {
    console.error('billing/[periodId] GET error:', error);
    return NextResponse.json({ message: 'Gagal memuat detail periode tagihan' }, { status: 500 });
  }
}
