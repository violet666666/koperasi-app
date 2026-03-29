import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// GET — Daftar produk pinjaman yang tersedia
export async function GET(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const products = await prisma.loanProduct.findMany({
            where: { isActive: true },
            orderBy: { name: "asc" },
        });

        return NextResponse.json({
            data: products.map((p) => ({
                id: p.id,
                code: p.code,
                name: p.name,
                interestRate: 0, // 0% per kebijakan Koperasi Primkoppol Lumajang
                adminFee: 1, // 1%
                maxAmount: Number(p.maxAmount),
                maxTenor: p.maxTenorMonths || 12,
                description: "Biaya jasa admin pemotongan sebesar 1% di awal.",
            })),
        });
    } catch (error) {
        console.error("GET /api/mobile/loan-apply error:", error);
        return NextResponse.json({ message: "Gagal memuat produk pinjaman" }, { status: 500 });
    }
}

// POST — Mengajukan pinjaman baru lewat HP
export async function POST(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const body = await request.json();
        const { loanProductId, amount, tenor, purpose } = body;

        if (!loanProductId || !amount || !tenor) {
            return NextResponse.json(
                { message: "Produk, jumlah pinjaman, dan tenor wajib diisi" },
                { status: 400 }
            );
        }

        // Verifikasi user & member
        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
            include: { member: true },
        });

        if (!user?.memberId || !user.member) {
            return NextResponse.json(
                { message: "Hanya anggota koperasi yang dapat mengajukan pinjaman" },
                { status: 403 }
            );
        }

        // Verifikasi produk pinjaman
        const product = await prisma.loanProduct.findUnique({
            where: { id: loanProductId },
        });

        if (!product || !product.isActive) {
            return NextResponse.json({ message: "Produk pinjaman tidak ditemukan" }, { status: 404 });
        }

        if (amount > Number(product.maxAmount)) {
            return NextResponse.json(
                { message: `Jumlah melebihi plafon maksimum ${Number(product.maxAmount).toLocaleString('id-ID')}` },
                { status: 400 }
            );
        }

        if (product.maxTenorMonths && tenor > product.maxTenorMonths) {
            return NextResponse.json(
                { message: `Tenor melebihi maksimum ${product.maxTenorMonths} bulan` },
                { status: 400 }
            );
        }

        // Cek pinjaman aktif yang sudah ada
        const existingActiveLoans = await prisma.loan.count({
            where: { memberId: user.memberId, status: { in: ["active", "overdue"] } },
        });

        if (existingActiveLoans >= 3) {
            return NextResponse.json(
                { message: "Anda sudah memiliki 3 pinjaman aktif. Selesaikan salah satu terlebih dahulu." },
                { status: 400 }
            );
        }

        // Hitung angsuran per bulan (Pokok saja) & Biaya Administrasi
        const adminFee = amount * 0.01; // Biaya jasa 1%
        const monthlyPrincipal = amount / tenor;
        const monthlyInstallment = monthlyPrincipal;

        // Buat aplikasi pinjaman
        const appPrefix = "APP-MOBILE-";
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const application = await prisma.loanApplication.create({
            data: {
                applicationNo: `${appPrefix}${Date.now()}-${randomString}`,
                memberId: user.memberId,
                createdById: user.id,
                productId: product.id,
                amount: amount,
                tenorMonths: tenor,
                purpose: purpose || "Keperluan pribadi",
                status: "submitted",
                submittedAt: new Date(),
            },
        });

        // Audit log
        const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            userId: user.id,
            action: "CREATE",
            module: "Pinjaman",
            description: `Pengajuan pinjaman via Mobile: ${user.member.name} - Rp ${amount.toLocaleString('id-ID')} (${tenor} bulan)`,
            userName: user.name,
            userEmail: user.email,
            userRole: mobileUser.role,
            targetId: String(application.id),
            targetType: "LoanApplication",
            ipAddress,
            userAgent,
            status: "success",
        });

        return NextResponse.json({
            message: "Pengajuan pinjaman berhasil dikirim! Mohon tunggu persetujuan admin.",
            data: {
                id: application.id,
                amount: amount,
                tenor: tenor,
                monthlyInstallment: Math.round(monthlyInstallment),
                status: "submitted",
            },
        });
    } catch (error) {
        console.error("POST /api/mobile/loan-apply error:", error);
        return NextResponse.json({ message: "Gagal mengajukan pinjaman" }, { status: 500 });
    }
}
