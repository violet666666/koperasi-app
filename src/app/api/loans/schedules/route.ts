import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get("limit") || "50");
        const status = searchParams.get("status") || "pending,overdue"; // pending, paid, overdue

        const statusArray = status.split(",");

        // Get schedules
        const schedules = await prisma.loanSchedule.findMany({
            where: {
                status: { in: statusArray },
                loan: {
                    status: "active"
                }
            },
            include: {
                loan: {
                    include: {
                        member: {
                            select: { name: true, memberNo: true }
                        }
                    }
                }
            },
            orderBy: {
                dueDate: "asc",
            },
            take: limit
        });

        // Format for frontend
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const data = schedules.map(schedule => {
            const dueDate = new Date(schedule.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            const daysUntilDue = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

            let currentStatus = "upcoming";
            if (schedule.status === "overdue" || daysUntilDue < 0) {
                currentStatus = "overdue";
            } else if (daysUntilDue === 0) {
                currentStatus = "due_today";
            }

            return {
                id: schedule.id,
                loanId: schedule.loan.id,
                loanNo: schedule.loan.loanNo,
                memberName: schedule.loan.member.name,
                memberNo: schedule.loan.member.memberNo,
                installmentNo: schedule.installmentNo,
                dueDate: schedule.dueDate,
                principalAmount: Number(schedule.principalAmount),
                interestAmount: Number(schedule.interestAmount),
                totalAmount: Number(schedule.totalAmount),
                status: currentStatus,
                daysUntilDue
            };
        });

        return NextResponse.json({ data });
    } catch (error: any) {
        console.error("GET /api/loans/schedules error:", error);
        return NextResponse.json(
            { message: "Gagal mengambil jadwal angsuran", error: error.message },
            { status: 500 }
        );
    }
}
