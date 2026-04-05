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

        // ── Lapis 3: Hitung total tagihan aktif dari SEMUA unit ───────────
        // Hanya hitung transaksi yang salary_cut dan belum lunas, kecuali yang voided
        const tagihanResult = await prisma.unitTransaction.aggregate({
            where: {
                memberId: member.id,
                paymentMethod: "salary_cut",
                isPaid: false,
                status: { in: ["completed", "pending_void"] },
            },
            _sum: { loanAmount: true },
        });

        const totalTagihan = Number(tagihanResult._sum.loanAmount || 0);
        const plafonPiutang = Number(member.plafonPiutang);
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
