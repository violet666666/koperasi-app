import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { paginationSchema, createMemberSchema } from "@/lib/validations";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "kasir"];

// GET /api/members - List all members
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const query = paginationSchema.parse({
            page: searchParams.get("page") || 1,
            perPage: searchParams.get("perPage") || 15,
            search: searchParams.get("search") || undefined,
            sortBy: searchParams.get("sortBy") || "name",
            sortOrder: searchParams.get("sortOrder") || "asc",
        });

        const branchId = searchParams.get("branchId");
        const status = searchParams.get("status");

        const where = {
            deletedAt: null,
            ...(query.search && {
                OR: [
                    { name: { contains: query.search, mode: "insensitive" as const } },
                    { memberNo: { contains: query.search, mode: "insensitive" as const } },
                    { nrp: { contains: query.search, mode: "insensitive" as const } },
                    { nik: { contains: query.search, mode: "insensitive" as const } },
                ],
            }),
            ...(branchId && { branchId: parseInt(branchId) }),
            ...(status && status !== "all" && { status }),
        };

        const [members, total] = await Promise.all([
            prisma.member.findMany({
                where,
                include: {
                    branch: true,
                },
                orderBy: { [query.sortBy || "name"]: query.sortOrder },
                skip: (query.page - 1) * query.perPage,
                take: query.perPage,
            }),
            prisma.member.count({ where }),
        ]);

        return NextResponse.json({
            data: members,
            meta: {
                page: query.page,
                perPage: query.perPage,
                total,
                totalPages: Math.ceil(total / query.perPage),
            },
        });
    } catch (error) {
        console.error("GET /api/members error:", error);
        return NextResponse.json(
            { message: "Failed to fetch members" },
            { status: 500 }
        );
    }
}

// POST /api/members - Create new member
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createMemberSchema.parse(body);

        // Auto-generate memberNo if not provided
        if (!data.memberNo) {
            if (data.nrp && data.nrp.trim() !== '') {
                data.memberNo = data.nrp.trim();
            } else {
                const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
                const randomId = Math.floor(1000 + Math.random() * 9000);
                data.memberNo = `MBR${dateStr}${randomId}`;
            }
        }

        // Check for duplicate member number
        const existingMemberNo = await prisma.member.findUnique({
            where: { memberNo: data.memberNo },
        });

        if (existingMemberNo) {
            return NextResponse.json(
                { message: "NRP sudah digunakan. Silakan coba simpan lagi." },
                { status: 400 }
            );
        }

        // Check for duplicate NIK
        if (data.nik) {
            const existingNik = await prisma.member.findUnique({
                where: { nik: data.nik },
            });
            if (existingNik) {
                return NextResponse.json(
                    { message: "NIK sudah terdaftar" },
                    { status: 400 }
                );
            }
        }

        // Create member and user in transaction
        const result = await prisma.$transaction(async (tx) => {
            const member = await tx.member.create({
                // Force TS casting because schemas divergence between strict Prisma and optional Zod at this boundary
                data: data as any,
                include: {
                    branch: true,
                },
            });

            // Find role anggota
            const anggotaRole = await tx.role.findUnique({
                where: { name: 'anggota' }
            });

            if (anggotaRole && data.nrp) {
                const hashedPassword = await bcrypt.hash("anggota123", 10);
                await tx.user.create({
                    data: {
                        name: member.name,
                        email: `${member.nrp}@koperasi.local`,
                        password: hashedPassword,
                        roleId: anggotaRole.id,
                        branchId: member.branchId,
                        memberId: member.id,
                        isActive: true
                    }
                });
            }

            return member;
        });

        // Audit log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "CREATE", module: "Anggota",
                description: `Pendaftaran anggota baru: ${result.name} (${result.memberNo})`,
                targetId: String(result.id), targetType: "Member",
                newData: { id: result.id, memberNo: result.memberNo, name: result.name },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({ data: result }, { status: 201 });
    } catch (error) {
        console.error("POST /api/members error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create member" },
            { status: 500 }
        );
    }
}
