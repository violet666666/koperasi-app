import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const stats = await prisma.member.updateMany({
            where: {
                deletedAt: null,
                tunlesKinerja: { not: null }
            },
            data: {
                tunlesKinerja: 0
            }
        });

        const reqInfo = extractRequestInfo(request);
        const userInfo = extractUserFromSession(session);
        await logAudit({
            ...userInfo, ...reqInfo,
            action: "UPDATE", module: "Anggota",
            description: `Mereset/mengosongkan data Tunjangan Kinerja (Tunkin) massal sebanyak ${stats.count} anggota.`,
            newData: { resetCount: stats.count },
        });

        return NextResponse.json({
            message: "Berhasil mereset data Tunkin secara massal",
            successCount: stats.count
        });
    } catch (error) {
        console.error("POST /api/members/reset-tunkin error:", error);
        return NextResponse.json(
            { message: "Gagal memproses reset Tunkin." },
            { status: 500 }
        );
    }
}
