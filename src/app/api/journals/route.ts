import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/journals - List journal entries
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const period = searchParams.get("period"); // "current", "last", "year", "all"
        const adjustment = searchParams.get("adjustment"); // "true" to filter only adjustments
        const search = searchParams.get("search") || "";

        const now = new Date();
        let dateFilter: any = {};

        if (period === "current") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
            dateFilter = { gte: start, lte: end };
        } else if (period === "last") {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0);
            dateFilter = { gte: start, lte: end };
        } else if (period === "year") {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31);
            dateFilter = { gte: start, lte: end };
        }

        const where: any = {};
        if (Object.keys(dateFilter).length > 0) {
            where.transactionDate = dateFilter;
        }
        if (adjustment === "true") {
            where.isAdjustment = true;
        }
        if (search) {
            where.description = { contains: search, mode: "insensitive" };
        }

        const journals = await prisma.journal.findMany({
            where,
            include: {
                lines: true,
                createdBy: { select: { id: true, name: true } },
            },
            orderBy: { transactionDate: "desc" },
            take: 200,
        });

        const data = journals.map((j) => {
            const totalDebit = j.lines.reduce((s, l) => s + Number(l.debit), 0);
            const totalCredit = j.lines.reduce((s, l) => s + Number(l.credit), 0);
            return {
                id: j.id,
                journalNo: j.journalNo,
                transactionDate: j.transactionDate.toISOString().split("T")[0],
                description: j.description,
                sourceType: j.sourceType,
                totalDebit,
                totalCredit,
                isPosted: j.isPosted,
                isAdjustment: j.isAdjustment,
                createdBy: j.createdBy,
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/journals error:", error);
        return NextResponse.json({ message: "Failed to fetch journals" }, { status: 500 });
    }
}
