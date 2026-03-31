import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(
    request: Request,
    { params }: { params: { id: string } }
) {
    try {
        const id = parseInt(params.id);
        if (isNaN(id)) {
            return NextResponse.json({ message: "Invalid ID" }, { status: 400 });
        }

        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                role: true,
                branch: true,
                member: {
                    include: {
                        savingsAccounts: {
                            where: { status: "active" }
                        },
                        loans: {
                            where: { status: "active" }
                        }
                    }
                },
            },
        });

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Specifically remove the password from the response
        const { password, ...userWithoutPassword } = user;

        // Calculate some basic stats if member exists
        let stats = null;
        if (user.member) {
            const totalSimpanan = user.member.savingsAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
            const totalPinjaman = user.member.loans.reduce((sum, loan) => sum + Number(loan.principalAmount), 0);
            const sisaPinjaman = user.member.loans.reduce((sum, loan) => sum + Number(loan.principalOutstanding), 0);
            
            // Dummy Estimasi SHU logic just for UI display as a demonstration
            const estimasiSHU = totalSimpanan * 0.05;

            stats = {
                totalSimpanan,
                totalPinjaman,
                sisaPinjaman,
                estimasiSHU
            };
        }

        return NextResponse.json({ 
            data: {
                ...userWithoutPassword,
                stats
            }
        });
    } catch (error) {
        console.error("GET /api/users/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch user Details" },
            { status: 500 }
        );
    }
}
