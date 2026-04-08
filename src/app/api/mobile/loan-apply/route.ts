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
                interestRate: Number(p.interestRate), // dari database (1% flat/bln)
                adminFee: p.adminFeeValue ? Number(p.adminFeeValue) : 2, // dari database (2% resiko)
                minAmount: p.minAmount ? Number(p.minAmount) : null,
                maxAmount: p.maxAmount ? Number(p.maxAmount) : null, // null = No Limit
                minTenor: p.minTenorMonths || 1,
                maxTenor: p.maxTenorMonths || 60, // dari database
                description: p.maxAmount
                    ? `Limit s/d Rp ${Number(p.maxAmount).toLocaleString('id-ID')} · Tenor ${p.maxTenorMonths} bln · Bunga ${Number(p.interestRate)}% flat/bln · Resiko ${p.adminFeeValue ? Number(p.adminFeeValue) : 2}%`
                    : `Min Rp ${Number(p.minAmount || 0).toLocaleString('id-ID')} · No Limit · Tenor ${p.maxTenorMonths} bln · Bunga ${Number(p.interestRate)}% flat/bln · Resiko ${p.adminFeeValue ? Number(p.adminFeeValue) : 2}%`,
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
                { message: "Hanya anggota PRIMKOPPOL yang dapat mengajukan pinjaman" },
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

        // Validasi jumlah minimal (per produk)
        if (product.minAmount && amount < Number(product.minAmount)) {
            return NextResponse.json(
                { message: `Jumlah minimal untuk ${product.name} adalah Rp ${Number(product.minAmount).toLocaleString('id-ID')}` },
                { status: 400 }
            );
        }

        // Validasi jumlah maksimal (per produk — null berarti No Limit)
        if (product.maxAmount && amount > Number(product.maxAmount)) {
            return NextResponse.json(
                { message: `Jumlah melebihi plafon maksimum ${product.name}: Rp ${Number(product.maxAmount).toLocaleString('id-ID')}` },
                { status: 400 }
            );
        }

        // Validasi tenor minimal (per produk)
        if (product.minTenorMonths && tenor < product.minTenorMonths) {
            return NextResponse.json(
                { message: `Tenor minimal ${product.minTenorMonths} bulan untuk ${product.name}` },
                { status: 400 }
            );
        }

        // Validasi tenor maksimal (per produk)
        if (product.maxTenorMonths && tenor > product.maxTenorMonths) {
            return NextResponse.json(
                { message: `Tenor melebihi maksimum ${product.name}: ${product.maxTenorMonths} bulan` },
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

        // Hitung angsuran per bulan (Pokok + Bunga flat dari produk)
        const ratePerMonth = Number(product.interestRate) / 100; // e.g. 1% → 0.01
        const interestPerMonth = amount * ratePerMonth;
        const totalInterest = interestPerMonth * tenor;
        const totalPiutang = amount + totalInterest;
        const monthlyInstallment = totalPiutang / tenor;

        // Buat aplikasi pinjaman
        const appPrefix = "APP-MOBILE-";
        const randomString = Math.random().toString(36).substring(2, 8).toUpperCase();
        
        const application = await prisma.loanApplication.create({
            data: {
                applicationNo: `${appPrefix}${Date.now()}-${randomString}`,
                memberId: user.memberId,
                branchId: 1, // Fallback DB requirement
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
                totalPiutang: totalPiutang, // Koperasi Piutang Koperasi
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
