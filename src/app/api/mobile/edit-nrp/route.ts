import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

/**
 * GET /api/mobile/edit-nrp — List recent store sales WITHOUT member (NRP kosong)
 * Kasir hanya melihat transaksi sendiri, Operator/Admin melihat semua
 */
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "30");

    try {
        const isKasir = user.role === "kasir";
        const where: any = {
            memberId: null, // Hanya transaksi tanpa NRP/anggota
        };
        if (isKasir) {
            where.createdById = Number(user.id);
        }

        // Exclude voided sales
        const sales = await prisma.storeSale.findMany({
            where,
            include: {
                items: {
                    include: { product: { select: { name: true } } },
                    take: 3, // Just preview
                },
                createdBy: { select: { name: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        // Filter out voided
        const filtered = sales.filter((s) => {
            const meta: any = s.metadata && typeof s.metadata === "object" ? s.metadata : {};
            return !meta.isVoided;
        });

        return NextResponse.json({
            data: filtered.map((s) => ({
                id: s.id,
                saleNo: s.saleNo,
                unitType: s.unitType,
                customerName: s.customerName,
                totalAmount: Number(s.totalAmount),
                paymentMethod: s.paymentMethod,
                itemPreview: s.items.map((i) => i.product?.name || "—").join(", "),
                itemCount: s.items.length,
                createdBy: s.createdBy?.name || "—",
                createdAt: s.createdAt.toISOString(),
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/edit-nrp error:", error);
        return NextResponse.json({ message: "Gagal memuat transaksi" }, { status: 500 });
    }
}

/**
 * POST /api/mobile/edit-nrp — Assign member (NRP) ke transaksi lama
 * Body: { saleId: number, memberId: number }
 * Hanya kasir (pemilik transaksi) atau operator/admin yang boleh
 */
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();
    if (user.role !== "kasir" && user.role !== "operator" && user.role !== "admin") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { saleId, memberId } = body;

        if (!saleId || !memberId) {
            return NextResponse.json({ message: "saleId dan memberId wajib diisi" }, { status: 400 });
        }

        const sale = await prisma.storeSale.findUnique({
            where: { id: Number(saleId) },
            include: {
                items: true,
                createdBy: { select: { name: true } },
            },
        });

        if (!sale) {
            return NextResponse.json({ message: "Transaksi tidak ditemukan" }, { status: 404 });
        }

        // Kasir hanya bisa edit transaksi sendiri
        if (user.role === "kasir" && sale.createdById !== Number(user.id)) {
            return NextResponse.json({ message: "Anda hanya bisa mengedit transaksi milik Anda sendiri" }, { status: 403 });
        }

        // Validasi: transaksi sudah punya member
        if (sale.memberId) {
            return NextResponse.json({ message: "Transaksi ini sudah memiliki NRP/anggota yang terdaftar" }, { status: 409 });
        }

        // Cek metadata voided
        const meta: any = sale.metadata && typeof sale.metadata === "object" ? sale.metadata : {};
        if (meta.isVoided) {
            return NextResponse.json({ message: "Tidak bisa mengedit transaksi yang sudah dibatalkan" }, { status: 409 });
        }

        // Validasi member exists
        const member = await prisma.member.findUnique({
            where: { id: Number(memberId), deletedAt: null },
            select: { id: true, name: true, nrp: true, memberNo: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        // Update the sale
        await prisma.storeSale.update({
            where: { id: Number(saleId) },
            data: { memberId: member.id },
        });

        // If the original sale was salary_cut, also create/update the unit transaction
        if (sale.paymentMethod === "salary_cut") {
            // Check if unit transaction already exists for this sale
            const existingUT = await prisma.unitTransaction.findFirst({
                where: {
                    OR: [
                        { notes: { contains: sale.saleNo } },
                        { transactionNo: { contains: sale.saleNo } },
                    ],
                },
            });

            if (existingUT && !existingUT.memberId) {
                await prisma.unitTransaction.update({
                    where: { id: existingUT.id },
                    data: { memberId: member.id },
                });
            }
        }

        await logAudit({
            userId: Number(user.id),
            userName: user.name,
            action: "UPDATE",
            module: "Toko",
            description: `Assign NRP ke transaksi ${sale.saleNo}: ${member.name} (${member.nrp || member.memberNo}) via mobile`,
            ipAddress: "mobile-app",
        });

        return NextResponse.json({
            message: `NRP berhasil ditambahkan ke ${sale.saleNo} → ${member.name} (${member.nrp || member.memberNo})`,
            data: { saleNo: sale.saleNo, member: { id: member.id, name: member.name, nrp: member.nrp } },
        });

    } catch (error) {
        console.error("POST /api/mobile/edit-nrp error:", error);
        return NextResponse.json({ message: "Gagal memperbarui NRP transaksi" }, { status: 500 });
    }
}
