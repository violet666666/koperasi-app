import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../middleware";

/**
 * GET /api/reports/faktur-potongan?month=4&year=2026
 *
 * Generate data faktur potongan gaji per anggota.
 * Sumber data:
 *   1. Simpanan Wajib (Sp)  — Member.tabunganWajib, dicek SavingsTransaction bulan ini
 *   2. Angsuran Pinjaman (P + J) — LoanSchedule jatuh tempo bulan ini
 *   3. Piutang Unit (BRG)   — UnitTransaction + StoreSale salary_cut belum lunas
 *
 * Pagination: ?page=1&perPage=20 (applies to fakturList array only)
 * Export: ?export=true returns ALL items (for Print)
 *
 * Akses: Operator only
 */
export async function GET(request: Request) {
    try {
        const user = getMobileUser(request);
        if (!user) return unauthorizedResponse();

        // Role check: Operator only (mobile parity with the web route).
        const isOperator = user.role === "operator" || user.role === "admin_sp";
        if (!isOperator) {
            return NextResponse.json(
                { message: "Hanya Operator yang dapat mengakses Faktur Potongan" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(request.url);
        const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        // Pagination params
        const isExport = searchParams.get("export") === "true";
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
        const perPage = Math.min(100, Math.max(1, parseInt(searchParams.get("perPage") || "20")));

        if (month < 1 || month > 12 || year < 2020 || year > 2100) {
            return NextResponse.json({ message: "Bulan/tahun tidak valid" }, { status: 400 });
        }

        // Date range for this month
        const dateFrom = new Date(Date.UTC(year, month - 1, 1));
        const dateTo = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day of month

        const ROMAWI = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"];
        const BULAN_LABEL = ["", "Januari", "Februari", "Maret", "April", "Mei", "Juni",
            "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

        // -- 1. Fetch all active members --
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: {
                id: true,
                name: true,
                nrp: true,
                memberNo: true,
                pangkat: true,   // Pangkat
                golongan: true,  // Golongan
                kesatuan: true,  // Kesatuan
                employeeType: true, // Jenis Pegawai
                noRekening: true, // No Rekening
                category: true,     // Polri / PNS
                tabunganWajib: true, // Nominal simpanan wajib per bulan
            },
            orderBy: { name: "asc" },
        });

        if (members.length === 0) {
            return NextResponse.json({
                data: { fakturList: [], month, year, periodLabel: `${BULAN_LABEL[month]} ${year}` },
            });
        }

        const memberIds = members.map((m) => m.id);

        // -- 2. Check which members already paid Simpanan Wajib this month --
        const savingsWajibProducts = await prisma.savingsProduct.findMany({
            where: { type: "wajib", isActive: true },
            select: { id: true },
        });
        const wajibProductIds = savingsWajibProducts.map((p) => p.id);

        let paidWajibMemberIds = new Set<number>();
        if (wajibProductIds.length > 0) {
            const paidTx = await prisma.savingsTransaction.findMany({
                where: {
                    memberId: { in: memberIds },
                    productId: { in: wajibProductIds },
                    type: "deposit",
                    status: "completed",
                    transactionDate: { gte: dateFrom, lte: dateTo },
                },
                select: { memberId: true },
            });
            paidWajibMemberIds = new Set(paidTx.map((t) => t.memberId));
        }

        // -- 3. Fetch active loan schedules due this month --
        const activeLoans = await prisma.loan.findMany({
            where: {
                memberId: { in: memberIds },
                status: "active",
            },
            select: {
                id: true,
                memberId: true,
                tenorMonths: true,
                schedules: {
                    where: {
                        dueDate: { gte: dateFrom, lte: dateTo },
                        status: { in: ["pending", "partial", "overdue"] },
                    },
                    select: {
                        installmentNo: true,
                        principalAmount: true,
                        interestAmount: true,
                        principalPaid: true,
                        interestPaid: true,
                    },
                },
            },
        });

        // Map: memberId -> { pokok, jasa, angsuranKe, totalTenor }
        const loanMap = new Map<number, { pokok: number; jasa: number; angsuranKe: string }>();
        for (const loan of activeLoans) {
            for (const sched of loan.schedules) {
                const pokok = Number(sched.principalAmount) - Number(sched.principalPaid);
                const jasa = Number(sched.interestAmount) - Number(sched.interestPaid);
                if (pokok <= 0 && jasa <= 0) continue;

                const existing = loanMap.get(loan.memberId);
                if (existing) {
                    existing.pokok += pokok;
                    existing.jasa += jasa;
                    // Keep the latest installment info
                } else {
                    loanMap.set(loan.memberId, {
                        pokok,
                        jasa,
                        angsuranKe: `${sched.installmentNo}/${loan.tenorMonths}`,
                    });
                }
            }
        }

        // -- 4. Fetch unpaid salary_cut piutang (Unit Transactions) --
        const unitPiutang = await prisma.unitTransaction.findMany({
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
                description: true,
            },
        });

        // Map: memberId -> array of { label, amount }
        const unitPiutangMap = new Map<number, { label: string; amount: number }[]>();
        for (const tx of unitPiutang) {
            if (!tx.memberId) continue;
            const items = unitPiutangMap.get(tx.memberId) || [];
            const unitLabel = getUnitShortLabel(tx.unitType);
            // Aggregate by unit type
            const existing = items.find((i) => i.label === unitLabel);
            if (existing) {
                existing.amount += Number(tx.amount);
            } else {
                items.push({ label: unitLabel, amount: Number(tx.amount) });
            }
            unitPiutangMap.set(tx.memberId, items);
        }

        // StoreSale salary_cut unpaid (toko piutang)
        const storePiutang = await prisma.storeSale.findMany({
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

        for (const sale of storePiutang) {
            if (!sale.memberId) continue;
            // Check if voided
            const meta = typeof sale.metadata === "string" ? JSON.parse(sale.metadata) : sale.metadata || {};
            if (meta.isVoided) continue;

            const items = unitPiutangMap.get(sale.memberId) || [];
            const existing = items.find((i) => i.label === "BRG");
            if (existing) {
                existing.amount += Number(sale.totalAmount);
            } else {
                items.push({ label: "BRG", amount: Number(sale.totalAmount) });
            }
            unitPiutangMap.set(sale.memberId, items);
        }

        // -- 5. Build faktur per member --
        const fakturList: FakturItem[] = [];
        let seqNo = 0;

        for (const member of members) {
            const potonganItems: PotonganLine[] = [];

            // Simpanan Wajib
            const tajib = Number(member.tabunganWajib || 0);
            if (tajib > 0 && !paidWajibMemberIds.has(member.id)) {
                potonganItems.push({ jenis: "Sp", ptKe: "", jumlah: tajib });
            }

            // Pinjaman
            const loan = loanMap.get(member.id);
            if (loan) {
                if (loan.pokok > 0) {
                    potonganItems.push({ jenis: "P", ptKe: loan.angsuranKe, jumlah: loan.pokok });
                }
                if (loan.jasa > 0) {
                    potonganItems.push({ jenis: "J", ptKe: "", jumlah: loan.jasa });
                }
            }

            // Piutang Unit
            const unitItems = unitPiutangMap.get(member.id) || [];
            for (const item of unitItems) {
                if (item.amount > 0) {
                    potonganItems.push({ jenis: item.label, ptKe: "", jumlah: item.amount });
                }
            }

            // Skip if no potongan
            if (potonganItems.length === 0) continue;

            seqNo++;
            const totalPotongan = potonganItems.reduce((s, p) => s + p.jumlah, 0);
            const monthStr = String(month).padStart(2, "0");
            const yearStr = String(year).slice(-2);

            fakturList.push({
                seq: seqNo,
                noRes: `FP/${monthStr}/${ROMAWI[month]}/${year}`,
                notaBuku: `NB-${monthStr}${yearStr}-${String(seqNo).padStart(4, "0")}`,
                nama: member.name,
                nrp: member.nrp || member.memberNo,
                pangkat: member.pangkat || member.category || "-",
                kesatuan: member.kesatuan || "-",
                potongan: potonganItems,
                totalPotongan,
            });
        }

        // Aggregates are always complete
        const totalAnggota = fakturList.length;
        const totalNominal = fakturList.reduce((s, f) => s + f.totalPotongan, 0);

        // Apply pagination only when NOT exporting
        if (isExport) {
            return NextResponse.json({
                data: {
                    fakturList,
                    month,
                    year,
                    periodLabel: `${BULAN_LABEL[month]} ${year}`,
                    totalAnggota,
                    totalNominal,
                },
            });
        }

        const totalItems = fakturList.length;
        const totalPages = Math.ceil(totalItems / perPage);
        const paginatedList = fakturList.slice((page - 1) * perPage, page * perPage);

        return NextResponse.json({
            data: {
                fakturList: paginatedList,
                month,
                year,
                periodLabel: `${BULAN_LABEL[month]} ${year}`,
                totalAnggota,
                totalNominal,
                pagination: {
                    page,
                    perPage,
                    totalItems,
                    totalPages,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/reports/faktur-potongan error:", error);
        return NextResponse.json(
            { message: "Gagal generate faktur potongan" },
            { status: 500 }
        );
    }
}

// -- Types --
interface PotonganLine {
    jenis: string;  // Sp, P, J, BRG, CM, dll
    ptKe: string;   // "6/12" or ""
    jumlah: number;
}

interface FakturItem {
    seq: number;
    noRes: string;
    notaBuku: string;
    nama: string;
    nrp: string;
    pangkat: string;
    kesatuan: string;
    potongan: PotonganLine[];
    totalPotongan: number;
}

// -- Helpers --
function getUnitShortLabel(unitType: string): string {
    const map: Record<string, string> = {
        toko: "BRG",
        cuci_mobil: "CM",
        barbershop: "BRB",
        fitness: "FIT",
        play_station: "PS",
        coffe_latar: "CF",
        resto: "RST",
        properti: "PRP",
    };
    return map[unitType] || unitType.toUpperCase().slice(0, 3);
}
