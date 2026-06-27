import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { scanAnomalies } from "@/lib/services/anomaly-detector";

// GET /api/reports/anomali?year=2026&month=6  (month opsional)
export async function GET(request: Request) {
    try {
        const session = await auth();
        const perms = (session?.user?.permissions ?? []) as string[];
        if (!session?.user || !perms.includes("manage_all")) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
        const monthRaw = searchParams.get("month");
        const month = monthRaw && monthRaw !== "all" ? parseInt(monthRaw) : null;

        const result = await scanAnomalies(prisma, year, month);
        return NextResponse.json({ data: result });
    } catch (error) {
        console.error("GET /api/reports/anomali error:", error);
        return NextResponse.json({ message: "Failed to scan anomalies" }, { status: 500 });
    }
}
