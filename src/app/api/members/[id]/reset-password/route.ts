import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import bcrypt from "bcryptjs";

interface Params {
    params: Promise<{ id: string }>;
}

// POST /api/members/[id]/reset-password
export async function POST(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user || !["operator", "admin", "admin_sp", "super_admin"].includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const member = await prisma.member.findUnique({
            where: { id: parseInt(id), deletedAt: null },
            include: { userAccount: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Anggota tidak ditemukan" }, { status: 404 });
        }

        if (!member.userAccount) {
            return NextResponse.json({ message: "Anggota tidak memiliki akun login" }, { status: 400 });
        }

        const newPassword = member.nrp || member.memberNo;
        if (!newPassword) {
            return NextResponse.json({ message: "NRP tidak ditemukan" }, { status: 400 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await prisma.user.update({
            where: { id: member.userAccount.id },
            data: {
                password: hashedPassword,
                email: `${newPassword}@koperasi.local`,
                isActive: true,
            },
        });

        return NextResponse.json({
            message: "Password berhasil direset",
            data: { username: newPassword, password: newPassword },
        });
    } catch (error) {
        console.error("Reset password error:", error);
        return NextResponse.json({ message: "Gagal reset password" }, { status: 500 });
    }
}
