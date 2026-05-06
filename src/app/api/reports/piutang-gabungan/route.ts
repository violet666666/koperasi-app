import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

/**
 * GET /api/reports/piutang-gabungan
 *
 * Piutang Gabungan per anggota dari 3 sumber:
 *   1. Piutang Toko  — StoreSale salary_cut yang belum lunas
 *   2. Piutang Unit  — UnitTransaction salary_cut yang belum lunas
 *   3. Piutang SP    — Loan principalOutstanding + interestOutstanding (active loans)
 *
 * Pagination: ?page=1&perPage=25
 * Export: ?export=true returns ALL items
 *
 * Akses: Operator only
 */
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role;
        const perms = session.user.permissions || [];
        const isOperator = role === "operator" || perms.includes("manage_all") || role === "admin_sp";
        if (!isOperator) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat mengakses laporan ini" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const isExport = searchParams.get("export") === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "25")));

        // 1. Fetch all active members
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: {
                id: true,
                name: true,
                nrp: true,
                memberNo: true,
                pangkat: true,
                golongan: true,
                kesatuan: true,
                employeeType: true,
                noRekening: true,
                category: true,
            },
            orderBy: { name: "asc" },
        });

        if (members.length === 0) {
            return NextResponse.json({
                data: { piutangList: [], totalAnggota: 0, totalPiutangToko: 0, totalPiutangUnit: 0, totalPiutangSP: 0, grandTotal: 0 },
            });
        }

        const memberIds = members.map((m) => m.id);

        // 2. Piutang Toko — StoreSale salary_cut, not voided
        const storeSales = await prisma.storeSale.findMany({
            where: {
                memberId: { in: memberIds },
                paymentMethod: "salary_cut",
            },
            select: {
                memberId: true,
                totalAmount: true,
                metadata: true,
            },
        });

        // 3. Piutang Unit — UnitTransaction salary_cut, unpaid
        const unitTransactions = await prisma.unitTransaction.findMany({
            where: {
                memberId: { in: memberIds },
                paymentMethod: "salary_cut",
                isPaid: false,
                status: "completed",
            },
            select: {
                memberId: true,
                amount: true,
                unitType: true,
            },
        });

        // 4. Piutang SP — Active loans with outstanding balance
        const activeLoans = await prisma.loan.findMany({
            where: {
                memberId: { in: memberIds },
                status: "active",
            },
            select: {
                memberId: true,
                loanNo: true,
                principalOutstanding: true,
                interestOutstanding: true,
                tenorMonths: true,
                disbursementDate: true,
                schedules: {
                    where: { status: { in: ["pending", "partial", "overdue"] } },
                    select: { installmentNo: true },
                    orderBy: { installmentNo: "asc" },
                    take: 1,
                },
            },
        });

        // Aggregate per member using Maps
        const tokoMap = new Map<number, number>();
        const unitMap = new Map<number, number>();
        const spMap = new Map<number, { pokok: number; jasa: number; angsuranKe: string; loanCount: number }>();

        for (const sale of storeSales) {
            if (!sale.memberId) continue;
            const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
            if (meta.isVoided) continue;
            tokoMap.set(sale.memberId, (tokoMap.get(sale.memberId) || 0) + Number(sale.totalAmount));
        }

        for (const tx of unitTransactions) {
            if (!tx.memberId) continue;
            unitMap.set(tx.memberId, (unitMap.get(tx.memberId) || 0) + Number(tx.amount));
        }

        for (const loan of activeLoans) {
            const pokok = Number(loan.principalOutstanding);
            const jasa = Number(loan.interestOutstanding);
            if (pokok <= 0 && jasa <= 0) continue;
            const existing = spMap.get(loan.memberId);
            if (existing) {
                existing.pokok += pokok;
                existing.jasa += jasa;
                existing.loanCount++;
            } else {
                const nextInstallment = loan.schedules[0]?.installmentNo;
                spMap.set(loan.memberId, {
                    pokok,
                    jasa,
                    angsuranKe: nextInstallment ? `${nextInstallment}/${loan.tenorMonths}` : "-",
                    loanCount: 1,
                });
            }
        }

        // 5. Build piutang list — only members with any piutang
        const piutangList: PiutangItem[] = [];
        let seqNo = 0;

        for (const member of members) {
            const piutangToko = tokoMap.get(member.id) || 0;
            const piutangUnit = unitMap.get(member.id) || 0;
            const sp = spMap.get(member.id);

            if (piutangToko <= 0 && piutangUnit <= 0 && !sp) continue;

            seqNo++;
            const piutangSPPokok = sp?.pokok || 0;
            const piutangSPJasa = sp?.jasa || 0;
            const totalPiutang = piutangToko + piutangUnit + piutangSPPokok + piutangSPJasa;

            piutangList.push({
                seq: seqNo,
                nama: member.name,
                nrp: member.nrp || member.memberNo,
                pangkat: member.pangkat || member.category || "-",
                kesatuan: member.kesatuan || "-",
                piutangToko,
                piutangUnit,
                piutangSPPokok,
                piutangSPJasa,
                totalPiutang,
                angsuranKe: sp?.angsuranKe || "-",
                loanCount: sp?.loanCount || 0,
            });
        }

        // Aggregates — always complete (not affected by pagination)
        const totalAnggota = piutangList.length;
        const totalPiutangToko = piutangList.reduce((s, p) => s + p.piutangToko, 0);
        const totalPiutangUnit = piutangList.reduce((s, p) => s + p.piutangUnit, 0);
        const totalPiutangSPPokok = piutangList.reduce((s, p) => s + p.piutangSPPokok, 0);
        const totalPiutangSPJasa = piutangList.reduce((s, p) => s + p.piutangSPJasa, 0);
        const grandTotal = piutangList.reduce((s, p) => s + p.totalPiutang, 0);

        // Export — return all
        if (isExport) {
            return NextResponse.json({
                data: {
                    piutangList,
                    totalAnggota,
                    totalPiutangToko,
                    totalPiutangUnit,
                    totalPiutangSPPokok,
                    totalPiutangSPJasa,
                    grandTotal,
                },
            });
        }

        // Paginate
        const totalItems = piutangList.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / perPage));
        const paginatedList = piutangList.slice((page - 1) * perPage, page * perPage);

        return NextResponse.json({
            data: {
                piutangList: paginatedList,
                totalAnggota,
                totalPiutangToko,
                totalPiutangUnit,
                totalPiutangSPPokok,
                totalPiutangSPJasa,
                grandTotal,
                pagination: { page, perPage, totalItems, totalPages },
            },
        });
    } catch (error) {
        console.error("GET /api/reports/piutang-gabungan error:", error);
        return NextResponse.json(
            { message: "Gagal generate laporan piutang gabungan" },
            { status: 500 }
        );
    }
}

interface PiutangItem {
    seq: number;
    nama: string;
    nrp: string;
    pangkat: string;
    kesatuan: string;
    piutangToko: number;
    piutangUnit: number;
    piutangSPPokok: number;
    piutangSPJasa: number;
    totalPiutang: number;
    angsuranKe: string;
    loanCount: number;
}
