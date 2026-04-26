import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * POST /api/unit-transactions/validate
 * Core Gatekeeper - Validasi 3 Lapis sebelum transaksi piutang diproses.
 * Dipanggil oleh semua unit POS sebelum menyimpan transaksi salary_cut.
 *
 * Body: { nrp: string, amount: number, unitType: string }
 * Response: { allowed: boolean, sisaLimit: number, plafonPiutang: number, totalTagihan: number, reason?: string }
 */
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();
        const { nrp, amount, unitType } = body;

        if (!nrp || !amount || !unitType) {
            return NextResponse.json(
                { message: "nrp, amount, dan unitType wajib diisi" },
                { status: 400 }
            );
        }

        // ── Lapis 1: Ambil data anggota dan cek eksistensi ────────────────
        const member = await prisma.member.findUnique({
            where: { nrp: String(nrp) },
            select: {
                id: true,
                name: true,
                nrp: true,
                status: true,
                occupation: true,
                plafonPiutang: true,
                salary: true,
                tunlesKinerja: true,
            },
        });

        if (!member) {
            return NextResponse.json(
                {
                    allowed: false,
                    reason: `Anggota dengan NRP ${nrp} tidak ditemukan di sistem.`,
                    sisaLimit: 0,
                    plafonPiutang: 0,
                    totalTagihan: 0,
                },
                { status: 200 }
            );
        }

        // ── Lapis 2: Cek status keaktifan anggota ─────────────────────────
        if (member.status !== "active") {
            return NextResponse.json(
                {
                    allowed: false,
                    reason: `Akun anggota ${member.name} berstatus "${member.status}". Transaksi piutang diblokir oleh sistem.`,
                    sisaLimit: 0,
                    plafonPiutang: Number(member.plafonPiutang),
                    totalTagihan: 0,
                    member: { name: member.name, nrp: member.nrp },
                },
                { status: 200 }
            );
        }

        // ── Lapis 3: Kalkulasi Sisa Limit ──────────────────────────────
        let plafonPiutang = Number(member.plafonPiutang);

        // FITUR OTOMATIS: Jika plafonPiutang masih 0 (belum diset operator), hitung limit kelayakan dari Sisa Gaji
        if (plafonPiutang === 0 && Number(member.salary || 0) > 0) {
            const activeLoans = await prisma.loan.findMany({
                where: { memberId: member.id, status: { in: ["active", "overdue"] } },
                select: { monthlyInstallment: true }
            });
            const totalAngsuran = activeLoans.reduce((sum, loan) => sum + Number(loan.monthlyInstallment || 0), 0);
            
            const salary = Number(member.salary || 0);
            const tunkin = Number(member.tunlesKinerja || 0);
            const sisaBersih = salary + tunkin - totalAngsuran;
            
            // Limit piutang = 50% dari sisa bersih gaji (setelah potongan angsuran)
            plafonPiutang = Math.max(0, Math.floor(sisaBersih * 0.5));
        }

        // Sumber: UnitTransaction (semua unit, karena Toko juga buat UnitTransaction untuk piutangnya)
        const tagihanUnitTx = await prisma.unitTransaction.aggregate({
            where: {
                memberId: member.id,
                paymentMethod: "salary_cut",
                isPaid: false,
                status: { in: ["completed", "pending_void"] },
            },
            _sum: { amount: true },
        });

        const totalTagihan = Number(tagihanUnitTx._sum?.amount ?? 0);
        const sisaLimit = plafonPiutang - totalTagihan;
        const nominalBelanja = Number(amount);

        if (nominalBelanja > sisaLimit) {
            return NextResponse.json(
                {
                    allowed: false,
                    reason: `Transaksi ditolak. Sisa limit Rp ${sisaLimit.toLocaleString("id-ID")} tidak mencukupi untuk belanja Rp ${nominalBelanja.toLocaleString("id-ID")}.`,
                    sisaLimit,
                    plafonPiutang,
                    totalTagihan,
                    member: { name: member.name, nrp: member.nrp, occupation: member.occupation },
                },
                { status: 200 }
            );
        }

        // ── LOLOS semua 3 lapis ───────────────────────────────────────────
        return NextResponse.json({
            allowed: true,
            sisaLimit,
            plafonPiutang,
            totalTagihan,
            sisaLimitSetelah: sisaLimit - nominalBelanja,
            member: {
                id: member.id,
                name: member.name,
                nrp: member.nrp,
                occupation: member.occupation,
            },
        });
    } catch (error) {
        console.error("POST /api/unit-transactions/validate error:", error);
        return NextResponse.json(
            { message: "Gagal memvalidasi transaksi" },
            { status: 500 }
        );
    }
}
