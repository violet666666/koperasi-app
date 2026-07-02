import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../middleware";
import { canAccessUnit } from "@/lib/mobile-auth-scope";

export const dynamic = "force-dynamic";

/**
 * GET /api/mobile/unit-packages?unitType=cuci_mobil
 *
 * Mengembalikan daftar paket layanan aktif dari database (UnitServicePackage)
 * sesuai unit type yang diminta. Menggantikan konstanta hardcode di KasirScreen mobile.
 */
export async function GET(request: Request) {
  const user = await getMobileUserWithScope(request);
  if (!user) return unauthorizedResponse();

  // Gate: hanya staff unit yang boleh melihat paket layanan
  if (user.role !== "kasir" && user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
    return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const unitType = searchParams.get("unitType");

    if (!unitType) {
      return NextResponse.json(
        { message: "Parameter unitType wajib diisi" },
        { status: 400 }
      );
    }

    // ── Unit-scope guard (Task 3) ─────────────────────────────────
    const unitOk = canAccessUnit(user, unitType);
    if (!unitOk.allowed) {
      return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
    }

    const packages = await prisma.unitServicePackage.findMany({
      where: {
        unitType,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        description: true,
        price: true,
        sortOrder: true,
      },
      orderBy: { sortOrder: "asc" },
    });

    return NextResponse.json({
      data: packages.map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description || "",
        price: Number(p.price),
        label: p.name, // alias untuk kompatibilitas dengan KasirScreen
      })),
      unitType,
      count: packages.length,
    });
  } catch (error) {
    console.error("GET /api/mobile/unit-packages error:", error);
    return NextResponse.json(
      { message: "Gagal memuat paket layanan" },
      { status: 500 }
    );
  }
}
