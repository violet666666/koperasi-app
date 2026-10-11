import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";

// GET /api/permissions
export async function GET() {
    try {
        const session = await auth();
        if (!session?.user || !["operator", "admin", "admin_sp"].includes(session.user.role)) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const permissions = await prisma.permission.findMany({
            orderBy: [{ module: "asc" }, { name: "asc" }],
        });

        // Group by module
        const grouped = permissions.reduce((acc, perm) => {
            if (!acc[perm.module]) {
                acc[perm.module] = [];
            }
            acc[perm.module].push(perm);
            return acc;
        }, {} as Record<string, typeof permissions>);

        return NextResponse.json({
            data: permissions,
            grouped,
        });
    } catch (error) {
        console.error("GET /api/permissions error:", error);
        return NextResponse.json(
            { message: "Failed to fetch permissions" },
            { status: 500 }
        );
    }
}
