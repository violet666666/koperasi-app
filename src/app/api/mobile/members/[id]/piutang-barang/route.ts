import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUserWithScope, unauthorizedResponse } from "../../../middleware";
import { canAccessBranch } from "@/lib/mobile-auth-scope";
import { AUTO_GENERATED_PIUTANG_PREFIX } from "@/lib/laporan-helpers";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/members/[id]/piutang-barang — Member's merchandise receivables
export async function GET(request: Request, { params }: Params) {
    try {
        const user = await getMobileUserWithScope(request);
        if (!user) return unauthorizedResponse();
        if (!["operator", "admin", "kasir", "admin_sp"].includes(user.role)) {
            return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
        }

        const { id } = await params;
        const memberId = parseInt(id);
        if (isNaN(memberId)) {
            return NextResponse.json({ message: "ID anggota tidak valid" }, { status: 400 });
        }

        const member = await prisma.member.findUnique({
            where: { id: memberId },
            select: { branchId: true },
        });
        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }
        if (!canAccessBranch(user, member.branchId).allowed) {
            return NextResponse.json({ message: "Akses ditolak: resource di luar scope anda." }, { status: 403 });
        }

        // Unpaid UnitTransactions (salary_cut receivables)
        // Exclude auto-generated records from POS (those are already represented by StoreSale)
        const unitPiutang = await prisma.unitTransaction.findMany({
            where: {
                memberId,
                paymentMethod: "salary_cut",
                isPaid: false,
                status: { in: ["completed", "pending_void"] },
                notes: { not: { startsWith: AUTO_GENERATED_PIUTANG_PREFIX } },
            },
            orderBy: { transactionDate: "desc" },
            select: {
                id: true,
                transactionNo: true,
                unitType: true,
                description: true,
                amount: true,
                loanAmount: true,
                transactionDate: true,
                paymentMethod: true,
                notes: true,
                status: true,
            },
        });

        // Unpaid StoreSales (salary_cut from Toko POS)
        const storeSales = await prisma.storeSale.findMany({
            where: {
                memberId,
                paymentMethod: "salary_cut",
            },
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                saleNo: true,
                totalAmount: true,
                customerName: true,
                createdAt: true,
                metadata: true,
                unitType: true,
                items: {
                    select: {
                        product: { select: { name: true } },
                        quantity: true,
                        unitPrice: true,
                        subtotal: true,
                    },
                },
            },
        });

        // Filter out voided StoreSales
        const activeStoreSales = storeSales.filter((s) => {
            const meta = (typeof s.metadata === "string" ? JSON.parse(s.metadata) : s.metadata) as Record<string, unknown> | null;
            return !meta?.isVoided;
        });

        // Map to unified format
        const mappedUnitPiutang = unitPiutang.map((t) => ({
            id: t.id,
            source: "unit_transaction" as const,
            transactionNo: t.transactionNo,
            unitType: t.unitType,
            description: t.description,
            amount: Number(t.amount),
            loanAmount: Number(t.loanAmount),
            transactionDate: t.transactionDate,
            status: t.status,
            notes: t.notes,
        }));

        const mappedStoreSales = activeStoreSales.map((s) => {
            const itemDesc = s.items?.map((i) => `${i.product?.name || "[Dihapus]"} x${i.quantity}`).join(", ");
            return {
                id: s.id + 10000000,
                source: "store_sale" as const,
                transactionNo: s.saleNo,
                unitType: s.unitType || "toko",
                description: itemDesc || "Pembelian Toko PRIMKOPPOL",
                amount: Number(s.totalAmount),
                loanAmount: Number(s.totalAmount),
                transactionDate: s.createdAt,
                status: "completed",
                notes: null,
                items: s.items?.map((i) => ({
                    name: i.product?.name || "[Dihapus]",
                    quantity: i.quantity,
                    unitPrice: Number(i.unitPrice),
                    subtotal: Number(i.subtotal),
                })) || [],
            };
        });

        // Merge and sort by date
        const allPiutang = [...mappedUnitPiutang, ...mappedStoreSales]
            .sort((a, b) => new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime());

        const totalPiutang = allPiutang.reduce((sum, p) => sum + p.amount, 0);
        const byUnitType = allPiutang.reduce<Record<string, number>>((acc, p) => {
            const ut = p.unitType || "lainnya";
            acc[ut] = (acc[ut] || 0) + p.amount;
            return acc;
        }, {});

        return NextResponse.json({
            data: {
                piutang: allPiutang,
                summary: {
                    totalItems: allPiutang.length,
                    totalAmount: totalPiutang,
                    byUnitType,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/members/[id]/piutang-barang error:", error);
        return NextResponse.json(
            { message: "Gagal memuat data piutang barang" },
            { status: 500 }
        );
    }
}
