import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";
import { sendBatchPushNotifications } from "@/lib/expo-push";
import { AUTO_GENERATED_PIUTANG_PREFIX } from "@/lib/laporan-helpers";

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

        let allTransactions = sales.map((s) => {
            const metadata: any = s.metadata && typeof s.metadata === "object" ? s.metadata : {};
            return {
                id: s.id,
                source: "store_sale" as const,
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
                isVoided: !!metadata.isVoided,
                voidPending: !!metadata.voidPending,
                voidReason: metadata.voidReason || metadata.voidPendingReason || null,
            };
        });

        // JALUR 1: Also fetch UnitTransaction for kasir with service-based units
        if (isKasir && user.unitType && ["cuci_mobil", "barbershop", "fotocopy"].includes(user.unitType)) {
            const unitTxs = await prisma.unitTransaction.findMany({
                where: {
                    unitType: user.unitType,
                    createdById: Number(user.id),
                    status: { not: "voided" },
                    notes: { not: { startsWith: AUTO_GENERATED_PIUTANG_PREFIX } },
                },
                include: {
                    member: { select: { id: true, name: true, memberNo: true } },
                },
                orderBy: { transactionDate: "desc" },
                take: limit,
            });

            const mappedUnitTxs = unitTxs.map((ut) => ({
                id: ut.id + 10_000_000,
                source: "unit_transaction" as const,
                saleNo: ut.transactionNo,
                unitType: ut.unitType,
                customerName: ut.member?.name || null,
                member: ut.member ? { id: ut.member.id, name: ut.member.name, memberNo: ut.member.memberNo } : null,
                totalAmount: Number(ut.amount),
                paymentMethod: ut.paymentMethod || "cash",
                itemCount: 0,
                items: [] as any[],
                createdBy: { id: Number(ut.createdById), name: "" },
                createdAt: ut.transactionDate.toISOString(),
                isVoided: ut.status === "voided",
                voidPending: ut.status === "pending_void",
                voidReason: null as string | null,
                description: ut.description,
                status: ut.status,
            }));

            allTransactions = [...allTransactions, ...mappedUnitTxs];
            allTransactions.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        }

        return NextResponse.json({ data: allTransactions });
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

        // Operator: auto-void langsung — restore stock to stockToko (same as web void flow)
        if (isOperator) {
            await prisma.$transaction(async (tx) => {
                for (const item of sale.items) {
                    const prod = await tx.storeProduct.findUnique({ where: { id: item.productId } });
                    if (prod && !prod.isService) {
                        const qty = Math.abs(item.quantity);
                        const newStockToko = prod.stockToko + qty;
                        const newStock = newStockToko + prod.stockGdg;
                        await tx.storeProduct.update({
                            where: { id: item.productId },
                            data: { stockToko: newStockToko, stock: newStock },
                        });

                        await tx.storeStockMovement.create({
                            data: {
                                productId: item.productId,
                                type: "in",
                                quantity: qty,
                                reference: `VOID ${sale.saleNo}`,
                                notes: `Pengembalian stok (void operator mobile)`,
                                operatorId: currentUserId,
                            },
                        });
                    }
                }

                metadata.isVoided = true;
                metadata.voidReason = reason;
                metadata.voidedById = currentUserId;
                metadata.voidedAt = now.toISOString();

                await tx.storeSale.update({
                    where: { id: sale.id },
                    data: { metadata },
                });
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

        // Kirim notifikasi ke semua operator/admin
        try {
            const admins = await prisma.user.findMany({
                where: { role: { in: ["operator", "admin"] }, fcmToken: { not: null } },
                select: { fcmToken: true }
            });

            if (admins.length > 0) {
                const messages = admins.map(admin => ({
                    to: admin.fcmToken as string,
                    title: "⚠️ Permintaan Void Masuk",
                    body: `Kasir ${sale.createdBy?.name} meminta pembatalan untuk transaksi toko ${sale.saleNo}.`,
                    data: { screen: "Approval" }
                }));
                await sendBatchPushNotifications(messages);
            }
        } catch (e) { console.error("Batch Push failed:", e); }

        return NextResponse.json({
            message: `Permintaan void untuk ${saleNo} telah dikirim ke Admin. Menunggu persetujuan.`,
            data: { saleNo: sale.saleNo, status: "pending_void" },
        }, { status: 201 });

    } catch (error) {
        console.error("POST /api/mobile/toko/history error:", error);
        return NextResponse.json({ message: "Gagal mengajukan void transaksi" }, { status: 500 });
    }
}
