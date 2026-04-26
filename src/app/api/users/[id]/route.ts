import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id: rawId } = await params;
        const id = parseInt(rawId);
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
            const tabunganWajib = Number(user.member.tabunganWajib || 0);
            const savingsAccountTotal = user.member.savingsAccounts.reduce((sum, account) => sum + Number(account.balance), 0);
            const totalSimpanan = savingsAccountTotal + tabunganWajib;
            const totalPinjaman = user.member.loans.reduce((sum, loan) => sum + Number(loan.principalAmount), 0);
            const sisaPinjaman = user.member.loans.reduce((sum, loan) => sum + Number(loan.principalOutstanding), 0);
            
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

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (!session.user.permissions?.includes("user_management") && !session.user.permissions?.includes("manage_all")) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id: rawId } = await params;
        const id = parseInt(rawId);
        if (isNaN(id)) return NextResponse.json({ message: "Invalid ID" }, { status: 400 });

        const body = await request.json();
        const { name, email, password, roleId, branchId, unitType, isActive } = body;

        const updateData: Record<string, unknown> = {};
        if (name !== undefined) updateData.name = name;
        if (email !== undefined) updateData.email = email;
        if (roleId !== undefined) updateData.roleId = Number(roleId);
        if (branchId !== undefined) updateData.branchId = branchId ? Number(branchId) : null;
        if (unitType !== undefined) updateData.unitType = unitType || null;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (password) updateData.password = await bcrypt.hash(password, 12);

        const user = await prisma.user.update({
            where: { id },
            data: updateData,
            include: { role: true, branch: true },
        });

        const { password: _, ...safeUser } = user;
        return NextResponse.json({ data: safeUser });
    } catch (error) {
        console.error("PUT /api/users/[id] error:", error);
        return NextResponse.json({ message: "Failed to update user" }, { status: 500 });
    }
}
