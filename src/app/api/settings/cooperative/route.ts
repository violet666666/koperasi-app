import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET() {
    try {
        // Calculate dynamic stats
        const totalMembers = await prisma.member.count({
            where: { status: "active" }
        });

        const activeSavings = await prisma.savingsAccount.aggregate({
            _sum: {
                balance: true
            },
            where: {
                status: "active"
            }
        });

        const activeCashBank = await prisma.cashBankAccount.aggregate({
            _sum: {
                currentBalance: true
            },
            where: {
                isActive: true
            }
        });

        // Calculate total assets (example logic: total cash bank + total outstanding loans)
        const totalAssets = Number(activeCashBank._sum.currentBalance || 0) + Number(activeSavings._sum.balance || 0);

        // Mock base profile since we do not have Cooperative Profile model yet.
        const profile = {
            name: "PRIMKOPPOL Resor Lumajang",
            legalName: "Primer Koperasi Kepolisian (PRIMKOPPOL) Resor Lumajang",
            registrationNumber: "518/BH/KDK.9/III/2005",
            taxId: "01.234.567.8-012.345",
            establishedDate: "2005-03-15",
            address: "Jl. Alun-Alun Utara No. 1",
            city: "Kabupaten Lumajang",
            province: "Jawa Timur",
            postalCode: "67316",
            phone: "(0334) 881110",
            email: "primkoppol@polreslumajang.go.id",
            website: "https://primkoppol-polreslumajang.go.id",
            logoUrl: "",
            description: "PRIMKOPPOL Resor Lumajang melayani anggota kepolisian Resor Lumajang dan jajarannya untuk meningkatkan kesejahteraan anggota melalui layanan simpanan dan pinjaman.",
            totalMembers,
            totalAssets,
        };

        return NextResponse.json({ data: profile });
    } catch (error) {
        console.error("GET /api/settings/cooperative error:", error);
        return NextResponse.json(
            { message: "Failed to fetch cooperative profile" },
            { status: 500 }
        );
    }
}
