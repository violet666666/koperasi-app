import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getMobileUser, unauthorizedResponse } from '../../middleware';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const { id } = await params;
    const memberId = parseInt(id, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ error: 'Invalid member ID' }, { status: 400 });
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      include: {
        savingsAccounts: {
          include: { product: { select: { name: true, code: true, type: true } } },
        },
        loans: {
          where: { status: 'active' },
          select: { principalAmount: true, principalOutstanding: true },
        },
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    const totalSavings = member.savingsAccounts.reduce((sum, acc) => sum + Number(acc.balance), 0) + Number(member.tabunganWajib || 0);
    const totalLoansOutstanding = member.loans.reduce((sum, l) => sum + Number(l.principalOutstanding), 0);

    return NextResponse.json({
      data: {
        id: member.id,
        memberNo: member.memberNo,
        name: member.name,
        nrp: member.nrp,
        email: member.email,
        phone: member.phone,
        category: member.category,
        occupation: member.occupation,
        gender: member.gender,
        address: member.address,
        joinDate: member.joinDate,
        status: member.status,
        salary: Number(member.salary || 0),
        tunlesKinerja: Number(member.tunlesKinerja || 0),
        tabunganWajib: Number(member.tabunganWajib || 0),
        totalSavings,
        totalLoansOutstanding,
        savingsAccounts: member.savingsAccounts.map(acc => ({
          id: acc.id,
          accountNo: acc.accountNo,
          balance: Number(acc.balance),
          product: acc.product,
        })),
      }
    });
  } catch (error) {
    console.error('Error in /api/mobile/members/[id]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}
