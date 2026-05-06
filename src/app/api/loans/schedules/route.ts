import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const roleName = typeof session.user.role === "string" ? session.user.role : (session.user.role as any)?.name;
        if (!["operator", "admin_sp"].includes(roleName)) {
            return NextResponse.json({ message: "Hanya Operator yang dapat mengakses data pinjaman." }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const status = searchParams.get("status") || "pending,overdue"; // pending, paid, overdue

        const statusArray = status.split(",");

        const period = searchParams.get("period") || "all";

        // Ambil semua pinjaman aktif beserta jadwal angsuran pertama/terdekat yang belum dibayar
        const activeLoans = await prisma.loan.findMany({
            where: {
                status: "active"
            },
            include: {
                member: {
                    select: { name: true, memberNo: true }
                },
                schedules: {
                    where: {
                        status: { in: statusArray }
                    },
                    orderBy: {
                        installmentNo: "asc" // Angsuran yang tagihannya paling awal
                    },
                    take: 1
                }
            }
        });

        // Format for frontend and filtering
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        let data = [];

        for (const loan of activeLoans) {
            if (loan.schedules.length === 0) continue; // Tidak ada jadwal pending untuk pinjaman ini

            const schedule = loan.schedules[0];
            const dueDate = new Date(schedule.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let currentStatus = "upcoming";
            if (schedule.status === "overdue" || daysUntilDue < 0) {
                currentStatus = "overdue";
            } else if (daysUntilDue === 0) {
                currentStatus = "due_today";
            }

            // Server-side filtering
            let matchFilter = true;
            if (period === "today") {
                matchFilter = (daysUntilDue === 0 || currentStatus === "due_today");
            } else if (period === "week") {
                matchFilter = (daysUntilDue <= 7);
            } else if (period === "month") {
                matchFilter = (daysUntilDue <= 30);
            } else if (period === "overdue") {
                matchFilter = (currentStatus === "overdue");
            }

            if (matchFilter) {
                data.push({
                    id: schedule.id,
                    loanId: loan.id,
                    loanNo: loan.loanNo,
                    memberName: loan.member.name,
                    memberNo: loan.member.memberNo,
                    installmentNo: schedule.installmentNo,
                    dueDate: schedule.dueDate,
                    principalAmount: Number(schedule.principalAmount),
                    interestAmount: Number(schedule.interestAmount),
                    totalAmount: Number(schedule.totalAmount),
                    status: currentStatus,
                    daysUntilDue
                });
            }
        }

        // Urutkan berdasarkan dueDate terdekat
        data.sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

        if (limit && data.length > limit) {
            data = data.slice(0, limit);
        }

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("GET /api/loans/schedules error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil jadwal angsuran", error: error.message },
            { status: 500 }
        );
    }
}
