import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/loans/kompen/simulate — Simulasi kompen
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) return NextResponse.json({ message: "Unauthorized" }, { status: 401 });

        const { searchParams } = new URL(request.url);
        const memberId = parseInt(searchParams.get("memberId") || "");
        const existingLoanId = parseInt(searchParams.get("existingLoanId") || "");
        const newAmount = parseFloat(searchParams.get("newAmount") || "0");
        const newProductId = parseInt(searchParams.get("newProductId") || "");
        const newTenor = parseInt(searchParams.get("newTenor") || "0");

        if (!memberId || !existingLoanId || !newAmount || !newProductId || !newTenor) {
            return NextResponse.json({ message: "Semua parameter wajib diisi" }, { status: 400 });
        }

        // Validate member
        const member = await prisma.member.findUnique({ where: { id: memberId } });
        if (!member || member.status !== "active") {
            return NextResponse.json({ message: "Anggota tidak aktif" }, { status: 400 });
        }

        // Validate existing loan
        const existingLoan = await prisma.loan.findUnique({ where: { id: existingLoanId } });
        if (!existingLoan || existingLoan.status !== "active") {
            return NextResponse.json({ message: "Pinjaman lama tidak aktif" }, { status: 400 });
        }
        if (existingLoan.memberId !== memberId) {
            return NextResponse.json({ message: "Pinjaman bukan milik anggota ini" }, { status: 400 });
        }

        // Validate product
        const product = await prisma.loanProduct.findFirst({ where: { id: newProductId, isActive: true } });
        if (!product) {
            return NextResponse.json({ message: "Produk pinjaman tidak ditemukan" }, { status: 404 });
        }

        // Calculate kompen
        const principalOutstanding = Number(existingLoan.principalOutstanding);
        const monthlyInterest = Math.round(Number(existingLoan.principalAmount) * (Number(existingLoan.interestRate) / 100));
        const penaltyFee = existingLoan.tenorMonths <= 24 ? monthlyInterest : monthlyInterest * 2;
        const totalKompen = principalOutstanding + penaltyFee;

        // Calculate new loan
        const interestRate = Number(product.interestRate) || 1;
        const interestPerMonth = Math.round(newAmount * (interestRate / 100));
        const totalInterest = interestPerMonth * newTenor;
        const adminFee = Math.round(newAmount * (Number(product.adminFeeValue) || 0.02));
        const disbursedToMember = newAmount - totalKompen - adminFee;
        const monthlyInstallment = Math.round(newAmount / newTenor) + interestPerMonth;

        if (disbursedToMember <= 0) {
            return NextResponse.json({
                message: `Plafon baru (${newAmount.toLocaleString('id-ID')}) tidak cukup untuk kompen (${totalKompen.toLocaleString('id-ID')}) + admin (${adminFee.toLocaleString('id-ID')})`,
            }, { status: 400 });
        }

        return NextResponse.json({
            data: {
                existingLoan: {
                    loanNo: existingLoan.loanNo,
                    principalOutstanding,
                    remainingTenor: existingLoan.tenorMonths,
                    monthlyInterest,
                },
                kompen: {
                    principalOutstanding,
                    penaltyFee,
                    totalKompen,
                },
                newLoan: {
                    principalAmount: newAmount,
                    adminFee,
                    interestRate,
                    tenorMonths: newTenor,
                    monthlyInstallment,
                    totalInterest,
                    disbursedToMember,
                },
                summary: {
                    plafonBaru: newAmount,
                    totalKompen,
                    biayaAdmin: adminFee,
                    danaDiterimaAnggota: disbursedToMember,
                },
            },
        });
    } catch (error) {
        console.error("GET /api/loans/kompen/simulate error:", error);
        return NextResponse.json({ message: "Gagal simulasi kompen" }, { status: 500 });
    }
}
