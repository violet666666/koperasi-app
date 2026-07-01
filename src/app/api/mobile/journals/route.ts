import { NextResponse } from "next/server";
import crypto from "crypto";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../middleware";

export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get("search") || "";
        const period = searchParams.get("period") || "all";
        const takeStr = searchParams.get("limit");
        const take = takeStr ? parseInt(takeStr) : 50;

        const now = new Date();
        let dateFilter: any = {};
        if (period === "current") {
            const start = new Date(now.getFullYear(), now.getMonth(), 1);
            const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
            dateFilter = { gte: start, lte: end };
        } else if (period === "last") {
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
            dateFilter = { gte: start, lte: end };
        } else if (period === "year") {
            const start = new Date(now.getFullYear(), 0, 1);
            const end = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
            dateFilter = { gte: start, lte: end };
        }

        const where: any = {};
        if (Object.keys(dateFilter).length > 0) where.transactionDate = dateFilter;
        if (search) where.description = { contains: search, mode: "insensitive" };

        const journals = await prisma.journal.findMany({
            where,
            include: { lines: true, createdBy: { select: { name: true } } },
            orderBy: { transactionDate: "desc" },
            take,
        });

        const data = journals.map(j => {
            const totalDebit = j.lines.reduce((s, l) => s + Number(l.debit), 0);
            const totalCredit = j.lines.reduce((s, l) => s + Number(l.credit), 0);
            return {
                id: j.id,
                journalNo: j.journalNo,
                transactionDate: j.transactionDate.toISOString(),
                description: j.description,
                sourceType: j.sourceType,
                isAdjustment: j.isAdjustment,
                totalDebit,
                totalCredit,
                creator: j.createdBy?.name || "System",
                linesCount: j.lines.length,
            };
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/mobile/journals error:", error);
        return NextResponse.json({ message: "Gagal memuat riwayat jurnal" }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const body = await request.json();
        const { date, description, lines } = body;

        if (!date || !description || !lines || !Array.isArray(lines) || lines.length < 2) {
            return NextResponse.json({ message: "Data jurnal tidak lengkap" }, { status: 400 });
        }

        // Hitung total Debit dan Kredit
        const totalDebit = lines.reduce((sum: number, line: any) => sum + Number(line.debit || 0), 0);
        const totalCredit = lines.reduce((sum: number, line: any) => sum + Number(line.credit || 0), 0);

        // Toleransi selisih karena floating point limit
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            return NextResponse.json(
                { message: `Jurnal tidak seimbang. Debit: ${totalDebit}, Kredit: ${totalCredit}` },
                { status: 400 }
            );
        }
        if (totalDebit <= 0) {
            return NextResponse.json({ message: "Nilai jurnal harus lebih dari 0" }, { status: 400 });
        }

        const trxDate = new Date(date);

        // Find active accounting period for this date
        const activePeriod = await prisma.fiscalPeriod.findFirst({
            where: {
                startDate: { lte: trxDate },
                endDate: { gte: trxDate },
                status: "open"
            }
        });

        if (!activePeriod) {
            return NextResponse.json({ message: "Tidak ada periode akuntansi yang aktif (Open) untuk tanggal ini." }, { status: 400 });
        }

        const journalPrefix = "JU/ADJ";
        const randomStr = (crypto.randomBytes(4).readUInt32BE(0) % 1000).toString().padStart(3, "0");

        const result = await prisma.$transaction(async (tx) => {
            const journal = await tx.journal.create({
                data: {
                    journalNo: `${journalPrefix}/${Date.now()}-${randomStr}`,
                    transactionDate: trxDate,
                    description,
                    sourceType: "manual",
                    isPosted: true, // Auto-post for manual adjustments via mobile
                    isAdjustment: true,
                    createdById: Number(user.id),
                    branchId: 1, // Fallback schema DB
                    periodId: activePeriod.id,
                    lines: {
                        create: lines.map((line: any) => ({
                            accountId: Number(line.accountId),
                            debit: Number(line.debit || 0),
                            credit: Number(line.credit || 0),
                            description: line.description || description,
                        })),
                    },
                },
                include: { lines: true },
            });

            await tx.auditLog.create({
                data: {
                    action: "CREATE",
                    module: "Akuntansi",
                    description: `Membuat Jurnal Manual [${journal.journalNo}] ID: ${journal.id}`,
                    userId: Number(user.id),
                    userName: user.name,
                    userRole: user.role,
                    status: "success",
                },
            });

            return journal;
        });

        return NextResponse.json({ message: "Jurnal berhasil disimpan", data: { journalNo: result.journalNo } });
    } catch (error) {
        console.error("POST /api/mobile/journals error:", error);
        return NextResponse.json({ message: "Terjadi kesalahan internal sistem" }, { status: 500 });
    }
}
