import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/reports/shu - SHU Report
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const branchId = searchParams.get("branchId");
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

        // Get member count and totals
        const members = await prisma.member.findMany({
            where: {
                status: "active",
                deletedAt: null,
                ...(branchId && { branchId: parseInt(branchId) }),
            },
            select: {
                id: true,
                memberNo: true,
                name: true,
            },
        });

        // For demo purposes, generate sample SHU distribution
        const shuTotal = 125000000; // Net income from laba-rugi
        const reserveFund = shuTotal * 0.25; // 25% dana cadangan
        const educationFund = shuTotal * 0.05; // 5% dana pendidikan
        const socialFund = shuTotal * 0.025; // 2.5% dana sosial
        const memberShare = shuTotal * 0.475; // 47.5% bagian anggota
        const managementShare = shuTotal * 0.20; // 20% bagian pengurus

        const shuPerMember = members.length > 0 ? memberShare / members.length : 0;

        const shuReport = {
            year,
            branchId: branchId ? parseInt(branchId) : null,
            totalSHU: shuTotal,
            distribution: {
                reserveFund: { percentage: 25, amount: reserveFund },
                educationFund: { percentage: 5, amount: educationFund },
                socialFund: { percentage: 2.5, amount: socialFund },
                memberShare: { percentage: 47.5, amount: memberShare },
                managementShare: { percentage: 20, amount: managementShare },
            },
            memberDistribution: {
                totalMembers: members.length,
                averageSharePerMember: shuPerMember,
                details: members.slice(0, 20).map((m, i) => ({
                    memberId: m.id,
                    memberNo: m.memberNo,
                    name: m.name,
                    savingsContribution: 15000000 + (i * 500000), // Sample
                    loanContribution: 25000000 + (i * 1000000), // Sample
                    shuShare: shuPerMember,
                })),
            },
        };

        return NextResponse.json({ data: shuReport });
    } catch (error) {
        console.error("GET /api/reports/shu error:", error);
        return NextResponse.json(
            { message: "Failed to generate SHU report" },
            { status: 500 }
        );
    }
}
