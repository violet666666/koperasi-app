import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { updateBranchSchema } from "@/lib/validations";

interface Params {
    params: Promise<{ id: string }>;
}

// GET /api/master/branches/[id]
export async function GET(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const branch = await prisma.branch.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!branch) {
            return NextResponse.json(
                { message: "Cabang tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: branch });
    } catch (error) {
        console.error("GET /api/master/branches/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch branch" },
            { status: 500 }
        );
    }
}

// PUT /api/master/branches/[id]
export async function PUT(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const body = await request.json();
        const data = updateBranchSchema.parse(body);

        const branch = await prisma.branch.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!branch) {
            return NextResponse.json(
                { message: "Cabang tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check for duplicate code if code is being updated
        if (data.code && data.code !== branch.code) {
            const existing = await prisma.branch.findUnique({
                where: { code: data.code },
            });
            if (existing) {
                return NextResponse.json(
                    { message: "Kode cabang sudah digunakan" },
                    { status: 400 }
                );
            }
        }

        const updated = await prisma.branch.update({
            where: { id: parseInt(id) },
            data,
        });

        return NextResponse.json({ data: updated });
    } catch (error) {
        console.error("PUT /api/master/branches/[id] error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to update branch" },
            { status: 500 }
        );
    }
}

// DELETE /api/master/branches/[id] - Soft delete
export async function DELETE(request: Request, { params }: Params) {
    try {
        const { id } = await params;
        const branch = await prisma.branch.findUnique({
            where: { id: parseInt(id), deletedAt: null },
        });

        if (!branch) {
            return NextResponse.json(
                { message: "Cabang tidak ditemukan" },
                { status: 404 }
            );
        }

        // Check if branch has related data
        const hasUsers = await prisma.user.count({
            where: { branchId: parseInt(id), deletedAt: null },
        });

        const hasMembers = await prisma.member.count({
            where: { branchId: parseInt(id), deletedAt: null },
        });

        if (hasUsers > 0 || hasMembers > 0) {
            return NextResponse.json(
                { message: "Cabang tidak dapat dihapus karena masih memiliki data terkait" },
                { status: 400 }
            );
        }

        // Soft delete
        await prisma.branch.update({
            where: { id: parseInt(id) },
            data: { deletedAt: new Date() },
        });

        return NextResponse.json({ message: "Cabang berhasil dihapus" });
    } catch (error) {
        console.error("DELETE /api/master/branches/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to delete branch" },
            { status: 500 }
        );
    }
}
