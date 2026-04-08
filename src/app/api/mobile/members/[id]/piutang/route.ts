import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/members/[id]/piutang
 *
 * Mengembalikan info plafon piutang anggota untuk validasi real-time
 * sebelum proses potong gaji di KasirScreen mobile.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();

  try {
    const { id } = await params;
    const memberId = parseInt(id);

    if (isNaN(memberId)) {
      return NextResponse.json(
        { message: "ID anggota tidak valid" },
        { status: 400 }
      );
    }

    const member = await prisma.member.findUnique({
      where: { id: memberId },
      select: { id: true, name: true, nrp: true, plafonPiutang: true },
    });

    if (!member) {
      return NextResponse.json(
        { message: "Anggota tidak ditemukan" },
        { status: 404 }
      );
    }

    // Hitung total piutang aktif (transaksi unit belum lunas)
    const piutangAktif = await prisma.unitTransaction.aggregate({
      where: {
        memberId,
        isPaid: false,
        status: { in: ["completed", "pending_void"] },
        paymentMethod: "salary_cut",
      },
      _sum: { amount: true },
    });

    const totalPlafon = Number(member.plafonPiutang);
    const sudahTerpakai = Number(piutangAktif._sum.amount ?? 0);
    const sisaLimit = Math.max(0, totalPlafon - sudahTerpakai);
    const canTransact = sisaLimit > 0 && totalPlafon > 0;

    return NextResponse.json({
      memberId,
      memberName: member.name,
      nrp: member.nrp,
      totalPlafon,
      sudahTerpakai,
      sisaLimit,
      canTransact,
    });
  } catch (error) {
    console.error("GET /api/mobile/members/[id]/piutang error:", error);
    return NextResponse.json(
      { message: "Gagal memuat data piutang anggota" },
      { status: 500 }
    );
  }
}
