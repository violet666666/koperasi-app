import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signMobileToken } from "@/lib/jwt";
import { logAudit } from "@/lib/audit-logger";

// POST /api/mobile/login - Authenticate mobile app users using JWT
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { identifier, password } = body;

        if (!identifier || !password) {
            return NextResponse.json({ message: "NRP/Email dan password wajib diisi" }, { status: 400 });
        }

        // Extract IP & UA from the request
        const ipAddress =
            request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
            request.headers.get("x-real-ip") ||
            "unknown";
        const userAgent = request.headers.get("user-agent") || "unknown";

        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: identifier },
                    { member: { nrp: identifier } }
                ]
            },
            include: {
                role: true,
                member: true,
            },
        });

        if (!user) {
            await logAudit({
                action: "LOGIN_FAILED",
                module: "AuthMobile",
                description: `Mobile Login gagal: akun '${identifier}' tidak ditemukan`,
                userName: identifier,
                userRole: "unknown",
                ipAddress,
                userAgent,
                status: "failed",
                errorMessage: "User not found",
            });
            return NextResponse.json({ message: "Akun tidak ditemukan" }, { status: 404 });
        }

        if (!user.isActive) {
            return NextResponse.json({ message: "Akun Anda dinonaktifkan" }, { status: 403 });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);

        if (!passwordMatch) {
            await logAudit({
                userId: user.id,
                action: "LOGIN_FAILED",
                module: "AuthMobile",
                description: `Mobile Login gagal: password salah untuk '${user.name}' (${identifier})`,
                userName: user.name,
                userEmail: user.email,
                userRole: user.role.name,
                ipAddress,
                userAgent,
                status: "failed",
                errorMessage: "Password mismatch",
            });
            return NextResponse.json({ message: "Password salah" }, { status: 401 });
        }

        // Log successful login
        await logAudit({
            userId: user.id,
            action: "LOGIN",
            module: "AuthMobile",
            description: `Mobile Login berhasil: ${user.name} (${identifier}) sebagai ${user.role.displayName}`,
            userName: user.name,
            userEmail: user.email,
            userRole: user.role.name,
            ipAddress,
            userAgent,
            status: "success",
        });

        // Generate JWT token
        const token = signMobileToken({
            id: String(user.id),
            email: user.email,
            name: user.name,
            role: user.role.name,
            nrp: user.member?.nrp || null,
            unitId: user.branchId,
        });

        return NextResponse.json({
            message: "Login berhasil",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role.name,
                roleDisplayName: user.role.displayName,
                nrp: user.member?.nrp || null,
            }
        });
    } catch (error) {
        console.error("POST /api/mobile/login error:", error);
        return NextResponse.json(
            { message: "Terjadi kesalahan pada server" },
            { status: 500 }
        );
    }
}
