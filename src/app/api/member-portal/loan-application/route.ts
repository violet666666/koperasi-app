import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

function generateApplicationNo(): string {
    const date = new Date();
    const year = date.getFullYear();
    const random = Math.floor(Math.random() * 100000).toString().padStart(5, "0");
    return `APP-${year}-${random}`;
}

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const user = await prisma.user.findUnique({
            where: { id: parseInt(session.user.id) },
            include: { member: true }
        });

        if (!user || !user.memberId || !user.member) {
            return NextResponse.json({ message: "Akun ini tidak tertaut dengan data Anggota." }, { status: 400 });
        }

        const member = user.member;
        if (member.status !== "active") {
            return NextResponse.json({ message: "Status keanggotaan Anda tidak aktif." }, { status: 400 });
        }

        const body = await request.json();
        const { productId, amount, tenorMonths, purpose } = body;

        if (!productId || !amount || !tenorMonths) {
            return NextResponse.json({ message: "Semua kolom wajib diisi" }, { status: 400 });
        }

        const product = await prisma.loanProduct.findFirst({
            where: { id: productId, isActive: true, isCurrent: true },
        });

        if (!product) {
            return NextResponse.json({ message: "Produk pinjaman tidak ditemukan" }, { status: 404 });
        }

        // Validate amount and tenor
        if (product.minAmount && amount < Number(product.minAmount)) {
            return NextResponse.json({ message: `Jumlah pinjaman minimal Rp ${Number(product.minAmount).toLocaleString("id-ID")}` }, { status: 400 });
        }

        if (product.maxAmount && amount > Number(product.maxAmount)) {
            return NextResponse.json({ message: `Jumlah pinjaman maksimal Rp ${Number(product.maxAmount).toLocaleString("id-ID")}` }, { status: 400 });
        }

        if (product.minTenorMonths && tenorMonths < product.minTenorMonths) {
            return NextResponse.json({ message: `Tenor minimal ${product.minTenorMonths} bulan` }, { status: 400 });
        }

        if (product.maxTenorMonths && tenorMonths > product.maxTenorMonths) {
            return NextResponse.json({ message: `Tenor maksimal ${product.maxTenorMonths} bulan` }, { status: 400 });
        }

        // === AD-ART Pasal 26: Validate limits ===
        const AD_ART_MAX_LOAN = 20000000;
        if (amount > AD_ART_MAX_LOAN) {
            return NextResponse.json({ message: `Sesuai AD-ART Pasal 26, pinjaman maksimal Rp 20.000.000` }, { status: 400 });
        }

        const AD_ART_MAX_TENOR_MONTHS = 36;
        if (tenorMonths > AD_ART_MAX_TENOR_MONTHS) {
            return NextResponse.json({ message: `Sesuai AD-ART Pasal 26, tenor pinjaman maksimal 3 tahun (36 bulan)` }, { status: 400 });
        }

        // TODO: Validate salary remainder limits based on pending installments
        const netSalary = Number(member.salary || 0);
        if (netSalary === 0) {
            return NextResponse.json({ message: `Gaji Anda belum terdaftar. Harap hubungi Admin.` }, { status: 400 });
        }

        // Create the application
        const application = await prisma.loanApplication.create({
            data: {
                applicationNo: generateApplicationNo(),
                memberId: member.id,
                branchId: member.branchId,
                productId,
                amount,
                tenorMonths,
                purpose,
                status: "submitted",
                submittedAt: new Date(),
                createdById: user.id,
            }
        });

        return NextResponse.json({ message: "Pengajuan pinjaman berhasil dibuat!", data: application }, { status: 201 });
    } catch (error) {
        console.error("POST /api/member-portal/loan-application error:", error);
        return NextResponse.json(
            { message: "Gagal mengirim pengajuan pinjaman" },
            { status: 500 }
        );
    }
}
