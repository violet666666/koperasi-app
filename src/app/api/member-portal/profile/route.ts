import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

// GET /api/member-portal/profile - Get full member profile
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const member = await prisma.member.findUnique({
            where: { id: session.user.memberId },
            include: { branch: true },
        });

        if (!member) {
            return NextResponse.json({ message: "Member not found" }, { status: 404 });
        }

        return NextResponse.json({ data: member });
    } catch (error) {
        console.error("GET /api/member-portal/profile error:", error);
        return NextResponse.json({ message: "Failed to fetch profile" }, { status: 500 });
    }
}

// PUT /api/member-portal/profile - Update own profile
export async function PUT(request: Request) {
    try {
        const session = await auth();
        if (!session?.user || !session.user.memberId) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json();

        // Only allow updating personal info fields (not memberNo, branchId, status, etc.)
        const allowedFields = [
            "name", "nik", "gender", "birthDate", "birthPlace",
            "maritalStatus", "religion", "education", "pangkat",
            "golongan", "kesatuan", "employeeType", "noRekening",
            "phone", "email", "address", "city", "province", "postalCode",
        ];

        const updateData: Record<string, any> = {};
        for (const field of allowedFields) {
            if (body[field] !== undefined && body[field] !== "") {
                if (field === "birthDate") {
                    updateData[field] = new Date(body[field]);
                } else {
                    updateData[field] = body[field];
                }
            }
        }

        const updated = await prisma.member.update({
            where: { id: session.user.memberId },
            data: updateData,
            include: { branch: true },
        });

        return NextResponse.json({ data: updated, message: "Profil berhasil diperbarui" });
    } catch (error) {
        console.error("PUT /api/member-portal/profile error:", error);
        return NextResponse.json({ message: "Failed to update profile" }, { status: 500 });
    }
}
