import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/billing/[periodId] — Get billing period detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const { periodId } = await params;
    const period = await prisma.billingPeriod.findUnique({
      where: { id: parseInt(periodId) },
      include: {
        billingItems: { orderBy: [{ memberId: "asc" }, { unitType: "asc" }] },
        processedBy: { select: { name: true } },
      },
    });

    if (!period) {
      return NextResponse.json({ message: "Period not found" }, { status: 404 });
    }

    return NextResponse.json({ data: period });
  } catch (error) {
    console.error("GET /api/billing/[periodId] error:", error);
    return NextResponse.json({ message: "Failed to fetch period" }, { status: 500 });
  }
}

// DELETE /api/billing/[periodId] — Delete draft billing period (cascade deletes items)
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ periodId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    const permissions = (session.user as { permissions?: string[] }).permissions ?? [];
    if (!permissions.includes("manage_all")) {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const { periodId } = await params;
    const id = parseInt(periodId);

    const period = await prisma.billingPeriod.findUnique({ where: { id } });
    if (!period) {
      return NextResponse.json({ message: "Period tidak ditemukan" }, { status: 404 });
    }
    if (period.status !== "draft") {
      return NextResponse.json(
        { message: "Hanya draft yang bisa dihapus. Period sudah diproses." },
        { status: 400 }
      );
    }

    await prisma.billingPeriod.delete({ where: { id } });

    return NextResponse.json({ message: "Draft billing period berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/billing/[periodId] error:", error);
    return NextResponse.json({ message: "Failed to delete period" }, { status: 500 });
  }
}
