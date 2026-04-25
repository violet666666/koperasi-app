import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = getMobileUser(request);
  if (!user) return unauthorizedResponse();

  // Hanya operator, admin yang bisa melihat laporan keuangan unit
  const role = (user as any).role;
  if (role !== "operator" && role !== "admin" && role !== "super_admin") {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unitType = searchParams.get("unitType");
    const period = searchParams.get("period") || "month";

    if (!unitType) {
      return NextResponse.json({ message: "Parameter unitType wajib diisi" }, { status: 400 });
    }

    // Determine date range based on period
    const now = new Date();
    let startDate = new Date();
    if (period === "today") {
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      const day = startDate.getDay();
      const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
      startDate = new Date(startDate.setDate(diff));
      startDate.setHours(0, 0, 0, 0);
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (period === "year") {
      startDate = new Date(now.getFullYear(), 0, 1);
    } else {
      // Default / all time -> fallback to year
      startDate = new Date(now.getFullYear(), 0, 1);
    }

    // 1. Get Pendapatan Kotor (Tota transaksi paid)
    const incomeAgg = await prisma.unitTransaction.aggregate({
      where: {
        unitType,
        isPaid: true,
        status: "completed",
        createdAt: { gte: startDate }
      },
      _sum: { amount: true }
    });
    const pendapatanKotor = Number(incomeAgg._sum.amount || 0);

    // 2. Get Pengeluaran Operasional
    // Try to map unitype to slug
    const unitSlugMap: Record<string, string> = {
      cuci_mobil: "cuci-mobil",
      barbershop: "barbershop",
      toko: "toko",
      resto_cafe: "resto-cafe"
    };
    const slug = unitSlugMap[unitType] || unitType;
    const unitAccount = await prisma.unitAccount.findUnique({
      where: { slug }
    });

    let totalPengeluaran = 0;
    if (unitAccount) {
      const expenseAgg = await prisma.operationalExpense.aggregate({
        where: {
          unitAccountId: unitAccount.id,
          createdAt: { gte: startDate }
        },
        _sum: { amount: true }
      });
      totalPengeluaran = Number(expenseAgg._sum.amount || 0);
    }

    // 3. Kalkulasi Bagi Hasil (50% karena ini Cuci Mobil test case)
    const bagianKaryawan = pendapatanKotor * 0.5;
    const bagianKoperasi = pendapatanKotor * 0.5;
    const labaBersihKoperasi = bagianKoperasi - totalPengeluaran;

    return NextResponse.json({
      data: {
        pendapatanKotor,
        bagianKaryawan,
        bagianKoperasi,
        totalPengeluaran,
        labaBersihKoperasi,
        period,
        unitType
      }
    });

  } catch (error) {
    console.error("GET /api/mobile/reports/unit error:", error);
    return NextResponse.json({ message: "Gagal memuat laporan unit" }, { status: 500 });
  }
}
