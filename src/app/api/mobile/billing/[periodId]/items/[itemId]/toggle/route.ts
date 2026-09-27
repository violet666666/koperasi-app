import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMobileUserWithScope, unauthorizedResponse } from '../../../../../middleware';

// POST /api/mobile/billing/[periodId]/items/[itemId]/toggle — Toggle isMarkedPaid
// Mirror persis dari web PATCH /api/billing/[periodId]/items/[itemId]/toggle:
// draft-only, flip isMarkedPaid, paidById/paidAt saat menandai, null saat batal.
// Gate: operator (sama seperti web yang butuh permission manage_all).

interface Params { params: Promise<{ periodId: string; itemId: string }> }

export async function POST(request: Request, { params }: Params) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'operator') {
    return NextResponse.json({ message: 'Akses ditolak' }, { status: 403 });
  }

  try {
    const { periodId, itemId } = await params;
    const pId = parseInt(periodId);
    const iId = parseInt(itemId);
    if (isNaN(pId) || isNaN(iId)) {
      return NextResponse.json({ message: 'ID tidak valid' }, { status: 400 });
    }

    const period = await prisma.billingPeriod.findUnique({ where: { id: pId } });

    if (!period || period.status !== 'draft') {
      return NextResponse.json({ message: 'Periode sudah diproses — tidak bisa diubah' }, { status: 400 });
    }

    const item = await prisma.billingItem.findUnique({ where: { id: iId } });

    if (!item || item.billingPeriodId !== pId) {
      return NextResponse.json({ message: 'Item tidak ditemukan' }, { status: 404 });
    }

    const updated = await prisma.billingItem.update({
      where: { id: item.id },
      data: {
        isMarkedPaid: !item.isMarkedPaid,
        paidById: !item.isMarkedPaid ? Number(user.id) : null,
        paidAt: !item.isMarkedPaid ? new Date() : null,
      },
    });

    return NextResponse.json({
      data: {
        id: updated.id,
        isMarkedPaid: updated.isMarkedPaid,
        paidAt: updated.paidAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('POST /api/mobile/billing/[periodId]/items/[itemId]/toggle error:', error);
    return NextResponse.json({ message: 'Gagal menandai item' }, { status: 500 });
  }
}
