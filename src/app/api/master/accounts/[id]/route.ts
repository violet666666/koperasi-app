import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { invalidateCache } from "@/lib/cache";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/master/accounts/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const account = await prisma.account.findUnique({
            where: { id: parseInt(id) },
        });

        if (!account) {
            return NextResponse.json(
                { message: "Akun tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: account });
    } catch (error) {
        console.error("GET /api/master/accounts/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch account" },
            { status: 500 }
        );
    }
}

// PUT /api/master/accounts/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        // Only operator/admin can edit
        if (session.user.role === "anggota" || session.user.role === "kasir") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.account.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing) {
            return NextResponse.json(
                { message: "Akun tidak ditemukan" },
                { status: 404 }
            );
        }

        // If code is changing, check uniqueness
        if (body.code && body.code !== existing.code) {
            const codeExists = await prisma.account.findUnique({
                where: { code: body.code },
            });
            if (codeExists) {
                return NextResponse.json(
                    { message: "Kode akun sudah digunakan" },
                    { status: 400 }
                );
            }
        }

        // Auto-determine level from parent
        let level = existing.level;
        if (body.parentId !== undefined) {
            if (body.parentId) {
                const parent = await prisma.account.findUnique({
                    where: { id: parseInt(body.parentId) },
                });
                if (parent) {
                    level = parent.level + 1;
                }
            } else {
                level = 1;
            }
        }

        const updated = await prisma.account.update({
            where: { id: parseInt(id) },
            data: {
                ...(body.code && { code: body.code }),
                ...(body.name && { name: body.name }),
                ...(body.type && { type: body.type }),
                ...(body.parentId !== undefined && { parentId: body.parentId ? parseInt(body.parentId) : null }),
                ...(body.normalBalance && { normalBalance: body.normalBalance }),
                ...(body.isDetail !== undefined && { isDetail: body.isDetail }),
                ...(body.isActive !== undefined && { isActive: body.isActive }),
                level,
            },
        });

        invalidateCache("accounts:");
        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/master/accounts/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update account" },
            { status: 500 }
        );
    }
}

// DELETE /api/master/accounts/[id]
export async function DELETE(request: Request, { params }: Params) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        if (session.user.role === "anggota" || session.user.role === "kasir") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const accountId = parseInt(id);

        // Check if has children
        const children = await prisma.account.count({
            where: { parentId: accountId },
        });
        if (children > 0) {
            return NextResponse.json(
                { message: "Tidak dapat menghapus akun yang memiliki sub-akun" },
                { status: 400 }
            );
        }

        // Check if has journal lines
        const journalLines = await prisma.journalLine.count({
            where: { accountId },
        });
        if (journalLines > 0) {
            return NextResponse.json(
                { message: "Tidak dapat menghapus akun yang sudah memiliki transaksi jurnal" },
                { status: 400 }
            );
        }

        await prisma.account.update({
            where: { id: accountId },
            data: { deletedAt: new Date() },
        });

        invalidateCache("accounts:");
        return NextResponse.json({ message: "Akun berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/master/accounts/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to delete account" },
            { status: 500 }
        );
    }
}
