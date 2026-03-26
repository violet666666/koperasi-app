import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { logAudit } from "@/lib/audit-logger";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    trustHost: true,
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials, request) {
                try {
                    console.log("[Auth] Attempting login for:", credentials?.email);

                    if (!credentials?.email || !credentials?.password) {
                        console.log("[Auth] Missing email or password");
                        return null;
                    }

                    const loginIdentifier = credentials.email as string;

                    // Extract IP & UA from the request if available
                    const ipAddress =
                        request?.headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ||
                        request?.headers?.get?.("x-real-ip") ||
                        "unknown";
                    const userAgent = request?.headers?.get?.("user-agent") || "unknown";

                    const user = await prisma.user.findFirst({
                        where: {
                            OR: [
                                { email: loginIdentifier },
                                { member: { nrp: loginIdentifier } }
                            ]
                        },
                        include: {
                            role: {
                                include: {
                                    permissions: {
                                        include: {
                                            permission: true,
                                        },
                                    },
                                },
                            },
                            branch: true,
                        },
                    });

                    if (!user) {
                        console.log("[Auth] User not found:", loginIdentifier);
                        // Log failed login attempt (user not found)
                        await logAudit({
                            action: "LOGIN_FAILED",
                            module: "Auth",
                            description: `Login gagal: akun '${loginIdentifier}' tidak ditemukan`,
                            userName: loginIdentifier,
                            userRole: "unknown",
                            ipAddress,
                            userAgent,
                            status: "failed",
                            errorMessage: "User not found",
                            metadata: { loginIdentifier },
                        });
                        return null;
                    }

                    if (!user.isActive) {
                        console.log("[Auth] User is inactive:", loginIdentifier);
                        // Log failed login (inactive account)
                        await logAudit({
                            userId: user.id,
                            action: "LOGIN_FAILED",
                            module: "Auth",
                            description: `Login gagal: akun '${user.name}' (${loginIdentifier}) tidak aktif`,
                            userName: user.name,
                            userEmail: user.email,
                            userRole: user.role.name,
                            ipAddress,
                            userAgent,
                            status: "failed",
                            errorMessage: "Account inactive",
                        });
                        return null;
                    }

                    const passwordMatch = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!passwordMatch) {
                        console.log("[Auth] Password mismatch for:", loginIdentifier);
                        // Log failed login (wrong password)
                        await logAudit({
                            userId: user.id,
                            action: "LOGIN_FAILED",
                            module: "Auth",
                            description: `Login gagal: password salah untuk '${user.name}' (${loginIdentifier})`,
                            userName: user.name,
                            userEmail: user.email,
                            userRole: user.role.name,
                            ipAddress,
                            userAgent,
                            status: "failed",
                            errorMessage: "Password mismatch",
                        });
                        return null;
                    }

                    console.log("[Auth] Login successful for:", loginIdentifier);

                    // Log successful login
                    await logAudit({
                        userId: user.id,
                        action: "LOGIN",
                        module: "Auth",
                        description: `Login berhasil: ${user.name} (${loginIdentifier}) sebagai ${user.role.displayName}`,
                        userName: user.name,
                        userEmail: user.email,
                        userRole: user.role.name,
                        ipAddress,
                        userAgent,
                        status: "success",
                        metadata: {
                            branchId: user.branchId,
                            branchName: user.branch?.name,
                        },
                    });

                    return {
                        id: String(user.id),
                        name: user.name,
                        email: user.email,
                        role: user.role.name,
                        roleDisplayName: user.role.displayName,
                        branchId: user.branchId,
                        branchName: user.branch?.name || null,
                        memberId: user.memberId || null,
                        unitType: user.unitType || null,
                        permissions: user.role.permissions.map((rp: { permission: { name: string } }) => rp.permission.name),
                    };
                } catch (error) {
                    console.error("[Auth] Error during authentication:", error);
                    return null;
                }
            },
        }),
    ],
    callbacks: {
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id!;
                token.role = user.role;
                token.roleDisplayName = user.roleDisplayName;
                token.branchId = user.branchId;
                token.branchName = user.branchName;
                token.memberId = user.memberId;
                token.unitType = (user as any).unitType;
                token.permissions = (user as any).permissions;
            }
            return token;
        },
        async session({ session, token }) {
            if (token && session.user) {
                session.user.id = token.id as string;
                session.user.role = token.role as string;
                session.user.roleDisplayName = token.roleDisplayName as string;
                session.user.branchId = token.branchId as number | null;
                session.user.branchName = token.branchName as string | null;
                session.user.memberId = token.memberId as number | null;
                session.user.unitType = (token.unitType as string) || null;
                session.user.permissions = token.permissions as string[];
            }
            return session;
        },
    },
    events: {
        async signOut(message) {
            // Log sign out event
            try {
                const token = "token" in message ? message.token : null;
                if (token) {
                    await logAudit({
                        userId: token.id ? Number(token.id) : null,
                        action: "LOGOUT",
                        module: "Auth",
                        description: `Logout: ${token.name || "Unknown"} (${token.email || ""})`,
                        userName: (token.name as string) || "Unknown",
                        userEmail: (token.email as string) || null,
                        userRole: (token.role as string) || "unknown",
                        status: "success",
                    });
                }
            } catch (error) {
                console.error("[AuditLog] Failed to log signOut:", error);
            }
        },
    },
});
