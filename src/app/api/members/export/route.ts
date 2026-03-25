import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// GET /api/members/export - Export members as CSV
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "csv";

        const members = await prisma.member.findMany({
            where: { deletedAt: null },
            include: { branch: true },
            orderBy: { name: "asc" },
        });

        if (format === "csv") {
            // Build CSV
            const headers = [
                "NO",
                "NRP/NIP",
                "NAMA",
                "KATEGORI",
                "CABANG",
                "GAJI_BERSIH",
                "TUNKIN",
                "STATUS",
                "TANGGAL_BERGABUNG",
            ];

            const rows = members.map((m, idx) => [
                idx + 1,
                m.nrp || m.memberNo,
                `"${(m.name || '').replace(/"/g, '""')}"`,
                m.category || '',
                m.branch?.name || '',
                m.salary ? Number(m.salary) : 0,
                m.tunlesKinerja ? Number(m.tunlesKinerja) : 0,
                m.status,
                m.joinDate ? new Date(m.joinDate).toISOString().split('T')[0] : '',
            ]);

            const csvContent = [
                headers.join(","),
                ...rows.map(r => r.join(",")),
            ].join("\n");

            return new Response(csvContent, {
                headers: {
                    "Content-Type": "text/csv; charset=utf-8",
                    "Content-Disposition": `attachment; filename="data_anggota_${new Date().toISOString().split('T')[0]}.csv"`,
                },
            });
        }

        // JSON format
        return NextResponse.json({
            data: members.map(m => ({
                nrp: m.nrp || m.memberNo,
                nama: m.name,
                kategori: m.category,
                cabang: m.branch?.name,
                gaji: m.salary ? Number(m.salary) : 0,
                tunkin: m.tunlesKinerja ? Number(m.tunlesKinerja) : 0,
                status: m.status,
            })),
        });
    } catch (error) {
        console.error("GET /api/members/export error:", error);
        return NextResponse.json(
            { message: "Gagal export data" },
            { status: 500 }
        );
    }
}
