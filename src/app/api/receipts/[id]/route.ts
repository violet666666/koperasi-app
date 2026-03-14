import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/receipts/[id] - Get receipt detail
export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const { id } = await params;
        const receipt = await prisma.receipt.findUnique({
            where: { id: parseInt(id) },
            include: {
                member: {
                    select: {
                        id: true,
                        memberNo: true,
                        nrp: true,
                        name: true,
                        phone: true,
                        category: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        if (!receipt) {
            return NextResponse.json(
                { message: "Kwitansi tidak ditemukan" },
                { status: 404 }
            );
        }

        return NextResponse.json({ data: receipt });
    } catch (error) {
        console.error("GET /api/receipts/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to fetch receipt" },
            { status: 500 }
        );
    }
}

// PUT /api/receipts/[id] - Update receipt
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        if (session.user.role === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { id } = await params;
        const body = await request.json();

        const existing = await prisma.receipt.findUnique({
            where: { id: parseInt(id) },
        });

        if (!existing) {
            return NextResponse.json(
                { message: "Kwitansi tidak ditemukan" },
                { status: 404 }
            );
        }

        // Only draft receipts can be edited
        if (existing.status !== "draft" && !body.status) {
            return NextResponse.json(
                { message: "Kwitansi yang sudah dicetak tidak dapat diedit" },
                { status: 400 }
            );
        }

        const updateData: Record<string, unknown> = {};

        if (body.status === "printed") {
            updateData.status = "printed";
            updateData.printedAt = new Date();
        } else if (body.status === "void") {
            updateData.status = "void";
        } else {
            // Edit draft fields
            if (body.description) updateData.description = body.description;
            if (body.amount) updateData.amount = parseFloat(body.amount);
            if (body.receivedFrom) updateData.receivedFrom = body.receivedFrom;
            if (body.paymentMethod) updateData.paymentMethod = body.paymentMethod;
            if (body.notes !== undefined) updateData.notes = body.notes;
            if (body.receiptDate) updateData.receiptDate = new Date(body.receiptDate);
        }

        const receipt = await prisma.receipt.update({
            where: { id: parseInt(id) },
            data: updateData,
            include: {
                member: {
                    select: {
                        id: true,
                        memberNo: true,
                        nrp: true,
                        name: true,
                    },
                },
                createdBy: {
                    select: {
                        id: true,
                        name: true,
                    },
                },
            },
        });

        return NextResponse.json({ data: receipt });
    } catch (error) {
        console.error("PUT /api/receipts/[id] error:", error);
        return NextResponse.json(
            { message: "Failed to update receipt" },
            { status: 500 }
        );
    }
}
