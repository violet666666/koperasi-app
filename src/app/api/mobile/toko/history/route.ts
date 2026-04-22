import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

/**
 * GET /api/mobile/toko/history — Riwayat transaksi kasir toko
 * Query params: ?limit=30&userId=xxx (userId optional, defaults to current user for kasir)
 *
 * POST /api/mobile/toko/history — Request void transaksi toko (StoreSale)
 * Body: { saleNo: string, reason: string }
 */
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get("limit") || "30");

    try {
        // Kasir: only see own transactions. Operator/Admin: see all
        const isKasir = user.role === "kasir";
        const where: any = {};
        if (isKasir) {
            where.createdById = Number(user.id);
        }

        const sales = await prisma.storeSale.findMany({
            where,
            include: {
                items: {
                    include: { product: { select: { name: true, sku: true } } },
                },
                createdBy: { select: { id: true, name: true } },
                member: { select: { id: true, name: true, memberNo: true } },
            },
            orderBy: { createdAt: "desc" },
            take: limit,
        });

        return NextResponse.json({
            data: sales.map((s) => {
                const metadata: any = s.metadata && typeof s.metadata === "object" ? s.metadata : {};
                return {
                    id: s.id,
                    saleNo: s.saleNo,
                    unitType: s.unitType || "toko",
                    customerName: s.customerName,
                    member: s.member ? { id: s.member.id, name: s.member.name, memberNo: s.member.memberNo } : null,
                    totalAmount: Number(s.totalAmount),
                    paymentMethod: s.paymentMethod,
                    itemCount: s.items.length,
                    items: s.items.map((i) => ({
                        name: i.product?.name || "—",
                        sku: i.product?.sku || "",
                        qty: i.quantity,
                        price: Number(i.unitPrice),
                        subtotal: Number(i.subtotal),
                    })),
                    createdBy: s.createdBy,
                    createdAt: s.createdAt.toISOString(),
                    // Void status flags
                    isVoided: !!metadata.isVoided,
                    voidPending: !!metadata.voidPending,
                    voidReason: metadata.voidReason || metadata.voidPendingReason || null,
                };
            }),
        });
    } catch (error) {
        console.error("GET /api/mobile/toko/history error:", error);
        return NextResponse.json({ message: "Gagal memuat riwayat transaksi" }, { status: 500 });
    }
}

/**
 * POST /api/mobile/toko/history — Request void transaksi toko dari kasir mobile
 */
export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    try {
        const body = await request.json();
        const { saleNo, reason } = body;

        if (!saleNo || !reason) {
            return NextResponse.json({ message: "saleNo dan reason (alasan) wajib diisi" }, { status: 400 });
        }

        const sale = await prisma.storeSale.findUnique({
            where: { saleNo: String(saleNo) },
            include: {
                items: true,
                member: { select: { name: true, nrp: true } },
                createdBy: { select: { name: true } },
            },
        });

        if (!sale) {
            return NextResponse.json({ message: `Transaksi ${saleNo} tidak ditemukan` }, { status: 404 });
        }

        // Kasir hanya bisa void transaksi miliknya sendiri
        if (user.role === "kasir" && sale.createdById !== Number(user.id)) {
            return NextResponse.json({ message: "Anda hanya bisa membatalkan transaksi milik Anda sendiri" }, { status: 403 });
        }

        const metadata: any = sale.metadata && typeof sale.metadata === "object" ? sale.metadata : {};

        if (metadata.isVoided) {
            return NextResponse.json({ message: "Transaksi ini sudah dibatalkan" }, { status: 409 });
        }
        if (metadata.voidPending) {
            return NextResponse.json({ message: "Permintaan void untuk transaksi ini sudah menunggu persetujuan" }, { status: 409 });
        }

        const now = new Date();
        const currentUserId = Number(user.id);
        const isOperator = user.role === "operator" || user.role === "admin";

        // Operator: auto-void langsung
        if (isOperator) {
            // Kembalikan stok
            for (const item of sale.items) {
                const prod = await prisma.storeProduct.findUnique({ where: { id: item.productId } });
                if (prod && !(prod as any).isService) {
                    await prisma.storeProduct.update({ where: { id: item.productId }, data: { stock: { increment: item.quantity } } });
                }
            }

            metadata.isVoided = true;
            metadata.voidReason = reason;
            metadata.voidedById = currentUserId;
            metadata.voidedAt = now.toISOString();

            await prisma.storeSale.update({
                where: { id: sale.id },
                data: { metadata },
            });

            return NextResponse.json({
                message: "Transaksi dibatalkan oleh Operator. Stok dikembalikan.",
                data: { saleNo: sale.saleNo, status: "voided" },
            });
        }

        // Kasir: pending void → buat approval request
        let branchId = 1;
        const headOffice = await prisma.branch.findFirst({ where: { isHeadOffice: true } });
        if (headOffice) branchId = headOffice.id;

        metadata.voidPending = true;
        metadata.voidPendingReason = reason;
        metadata.voidRequestedById = currentUserId;
        metadata.voidRequestedAt = now.toISOString();

        await prisma.storeSale.update({
            where: { id: sale.id },
            data: { metadata },
        });

        const requestNo = `VOID-${sale.saleNo}`;
        await prisma.approvalRequest.create({
            data: {
                requestNo,
                type: "void_store_sale",
                referenceType: "store_sale",
                referenceId: sale.id,
                branchId,
                amount: sale.totalAmount,
                description: `Pembatalan Transaksi Toko [${sale.saleNo}] — ${reason}`,
                requestedById: currentUserId,
                requestedAt: now,
                status: "pending",
                metadata: {
                    saleId: sale.id,
                    saleNo: sale.saleNo,
                    unitType: sale.unitType || "toko",
                    voidReason: reason,
                    itemCount: sale.items.length,
                    memberName: sale.member?.name || sale.customerName || "Walk-in",
                    memberNrp: sale.member?.nrp || "-",
                    kasirName: sale.createdBy?.name || "Kasir",
                },
            },
        });

        return NextResponse.json({
            message: `Permintaan void untuk ${saleNo} telah dikirim ke Admin. Menunggu persetujuan.`,
            data: { saleNo: sale.saleNo, status: "pending_void" },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/mobile/toko/history error:", error);
        return NextResponse.json({ message: "Gagal mengajukan void transaksi" }, { status: 500 });
    }
}
