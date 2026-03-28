import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { getMobileUser, unauthorizedResponse } from "../middleware";
import { logAudit } from "@/lib/audit-logger";

// POST /api/mobile/change-password — Ganti password dari HP
export async function POST(request: Request) {
    const mobileUser = getMobileUser(request);
    if (!mobileUser) return unauthorizedResponse();

    try {
        const body = await request.json();
        const { currentPassword, newPassword } = body;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { message: "Password lama dan password baru wajib diisi" },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { message: "Password baru minimal 6 karakter" },
                { status: 400 }
            );
        }

        const user = await prisma.user.findUnique({
            where: { id: Number(mobileUser.id) },
        });

        if (!user) {
            return NextResponse.json({ message: "User tidak ditemukan" }, { status: 404 });
        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);
        if (!isMatch) {
            return NextResponse.json({ message: "Password lama salah" }, { status: 401 });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        await prisma.user.update({
            where: { id: user.id },
            data: { password: hashedPassword },
        });

        // Audit log
        const ipAddress = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";
        await logAudit({
            userId: user.id,
            action: "UPDATE",
            module: "AuthMobile",
            description: `Password diubah via Mobile App oleh ${user.name}`,
            userName: user.name,
            userEmail: user.email,
            userRole: mobileUser.role,
            ipAddress,
            userAgent,
            status: "success",
        });

        return NextResponse.json({ message: "Password berhasil diubah" });
    } catch (error) {
        console.error("POST /api/mobile/change-password error:", error);
        return NextResponse.json({ message: "Gagal mengubah password" }, { status: 500 });
    }
}
