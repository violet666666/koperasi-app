import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getMobileUser, unauthorizedResponse } from '../../middleware';
import { logAudit } from '@/lib/audit-logger';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    // Hanya operator, admin, kasir yang bisa melihat data member lain
    const role = (user as any).role;
    if (role !== "operator" && role !== "admin" && role !== "kasir" && role !== "super_admin" && role !== "admin_sp") {
      return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

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
          where: { status: { in: ['active', 'overdue'] } },
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
        pangkat: member.pangkat,
        golongan: member.golongan,
        kesatuan: member.kesatuan,
        employeeType: member.employeeType,
        noRekening: member.noRekening,
        gender: member.gender,
        address: member.address,
        joinDate: member.joinDate,
        status: member.status,
        salary: Number(member.salary || 0),
        tunlesKinerja: Number(member.tunlesKinerja || 0),
        tabunganWajib: Number(member.tabunganWajib || 0),
        plafonPiutang: Number(member.plafonPiutang || 0),
        totalSavings,
        totalLoansOutstanding,
        savingsAccounts: [
          ...member.savingsAccounts.map(acc => ({
            id: acc.id,
            accountNo: acc.accountNo,
            balance: Number(acc.balance),
            product: acc.product,
          })),
          ...(Number(member.tabunganWajib || 0) > 0 ? [{
            id: -1,
            accountNo: `TAJIB-${member.id}`,
            balance: Number(member.tabunganWajib),
            product: { name: 'Tabungan Wajib (TAJIB)', code: 'TAJIB', type: 'wajib' },
          }] : []),
        ],
      }
    });
  } catch (error) {
    console.error('Error in GET /api/mobile/members/[id]:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/mobile/members/[id] — Update member data from mobile
 * Only operator/admin can update. Fields: phone, email, salary, tunlesKinerja, plafonPiutang, category, pangkat, golongan, kesatuan, employeeType, noRekening, address
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== 'operator' && user.role !== 'admin' && user.role !== 'admin_sp') {
      return NextResponse.json({ message: 'Hanya Operator/Admin yang dapat mengedit data anggota' }, { status: 403 });
    }

    const { id } = await params;
    const memberId = parseInt(id, 10);
    if (isNaN(memberId)) {
      return NextResponse.json({ message: 'Invalid member ID' }, { status: 400 });
    }

    const member = await prisma.member.findUnique({ where: { id: memberId, deletedAt: null } });
    if (!member) {
      return NextResponse.json({ message: 'Anggota tidak ditemukan' }, { status: 404 });
    }

    const body = await request.json();

    // Whitelist editable fields
    const allowedFields: Record<string, string> = {
      phone: 'string',
      email: 'string',
      address: 'string',
      category: 'string',
      pangkat: 'string',
      golongan: 'string',
      kesatuan: 'string',
      employeeType: 'string',
      noRekening: 'string',
      salary: 'number',
      tunlesKinerja: 'number',
      plafonPiutang: 'number',
    };

    const updateData: any = {};
    const changes: string[] = [];

    for (const [key, type] of Object.entries(allowedFields)) {
      if (body[key] !== undefined && body[key] !== null) {
        if (type === 'number') {
          const numVal = Number(body[key]);
          if (isNaN(numVal) || numVal < 0) {
            return NextResponse.json({ message: `Field ${key} harus berupa angka positif` }, { status: 400 });
          }
          const oldVal = Number((member as any)[key] || 0);
          if (oldVal !== numVal) {
            updateData[key] = numVal;
            changes.push(`${key}: ${oldVal.toLocaleString('id-ID')} → ${numVal.toLocaleString('id-ID')}`);
          }
        } else {
          const strVal = String(body[key]).trim();
          const oldVal = (member as any)[key] || '';
          if (oldVal !== strVal) {
            updateData[key] = strVal || null;
            changes.push(`${key}: "${oldVal}" → "${strVal}"`);
          }
        }
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Tidak ada perubahan data' }, { status: 200 });
    }

    await prisma.member.update({
      where: { id: memberId },
      data: updateData,
    });

    await logAudit({
      userId: Number(user.id),
      userName: user.name,
      action: 'UPDATE',
      module: 'Anggota',
      description: `Edit data anggota ${member.name} (${member.nrp || member.memberNo}) via mobile: ${changes.join(', ')}`,
      ipAddress: 'mobile-app',
    });

    return NextResponse.json({
      message: `Data anggota ${member.name} berhasil diperbarui`,
      data: { updatedFields: Object.keys(updateData), changes },
    });

  } catch (error) {
    console.error('PATCH /api/mobile/members/[id] error:', error);
    return NextResponse.json({ message: 'Gagal memperbarui data anggota' }, { status: 500 });
  }
}
