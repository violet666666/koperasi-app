import NextAuth from "next-auth";
import type { Adapter } from "next-auth/adapters";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
    adapter: PrismaAdapter(prisma) as Adapter,
    session: {
        strategy: "jwt",
    },
    pages: {
        signIn: "/login",
    },
    providers: [
        Credentials({
            name: "credentials",
            credentials: {
                email: { label: "Email", type: "email" },
                password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
                try {
                    console.log("[Auth] Attempting login for:", credentials?.email);

                    if (!credentials?.email || !credentials?.password) {
                        console.log("[Auth] Missing email or password");
                        return null;
                    }

                    const user = await prisma.user.findUnique({
                        where: { email: credentials.email as string },
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
                        console.log("[Auth] User not found:", credentials.email);
                        return null;
                    }

                    if (!user.isActive) {
                        console.log("[Auth] User is inactive:", credentials.email);
                        return null;
                    }

                    const passwordMatch = await bcrypt.compare(
                        credentials.password as string,
                        user.password
                    );

                    if (!passwordMatch) {
                        console.log("[Auth] Password mismatch for:", credentials.email);
                        return null;
                    }

                    console.log("[Auth] Login successful for:", credentials.email);

                    return {
                        id: String(user.id),
                        name: user.name,
                        email: user.email,
                        role: user.role.name,
                        roleDisplayName: user.role.displayName,
                        branchId: user.branchId,
                        branchName: user.branch?.name || null,
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
                token.permissions = user.permissions;
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
                session.user.permissions = token.permissions as string[];
            }
            return session;
        },
    },
});
