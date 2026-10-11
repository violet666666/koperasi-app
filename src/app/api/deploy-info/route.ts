import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
    const session = await auth();
    if (!session?.user || !["operator", "admin", "admin_sp", "kasir"].includes(session.user.role)) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json({
        deployBranch: "railway-migration",
        deployTime: new Date().toISOString(),
        version: "2025-05-11-v3",
        features: {
            storeSaleQuery: true,
            salaryCutDedup: true,
            isPaidStoreFilter: true,
            paidDateField: true,
            cafeLspDropdown: true,
        },
    });
}
