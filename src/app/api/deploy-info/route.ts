import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
    return NextResponse.json({
        deployBranch: "railway-migration",
        deployTime: new Date().toISOString(),
        version: "2025-05-11-v2",
        features: {
            storeSaleQuery: true,
            salaryCutDedup: true,
            isPaidStoreFilter: true,
            paidDateField: true,
            cafeLspDropdown: true,
        },
    });
}
