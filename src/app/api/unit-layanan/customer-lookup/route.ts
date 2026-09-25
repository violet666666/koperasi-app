import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { extractNoteTag, detectLookupQuery } from "@/lib/services/unit-notes";

// GET /api/unit-layanan/customer-lookup?q=08123456|N 1234 XY
// Cari pelanggan cuci mobil dua arah:
// - No. HP (>= 8 digit, prefix-match) → nama, SEMUA plat, jumlah kunjungan, terakhir
// - No. plat → pemilik (nama + no. HP) dari transaksi terakhir yang memakai plat itu
// Sumber: UnitTransaction.notes tag [HP:]/[PLAT:]/[NAMA:] — tanpa tabel/model baru.
export async function GET(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }
        const role = (session.user as { role?: string }).role;
        if (role === "anggota") {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const { searchParams } = new URL(request.url);
        const parsed = detectLookupQuery(searchParams.get("q") ?? searchParams.get("phone"));
        if (!parsed) {
            return NextResponse.json({ data: null });
        }

        const rows = await prisma.unitTransaction.findMany({
            where: {
                unitType: "cuci_mobil",
                status: { not: "voided" },
                notes: parsed.mode === "phone"
                    ? { contains: `[HP:${parsed.value}` } // prefix-match utk suggest sambil mengetik
                    : { contains: `[PLAT:${parsed.value}]` },
            },
            orderBy: { createdAt: "desc" },
            take: 500,
            select: { notes: true, transactionDate: true },
        });

        if (rows.length === 0) {
            return NextResponse.json({ data: null });
        }

        // Identitas pelanggan diambil dari baris terbaru yang punya tag lengkap
        const phone = parsed.mode === "phone" ? (extractNoteTag(rows[0].notes, "HP") || parsed.value)
            : rows.map(r => extractNoteTag(r.notes, "HP")).find(Boolean) || null;
        const name = rows.map(r => extractNoteTag(r.notes, "NAMA")).find(Boolean) || null;

        const plates: string[] = [];
        for (const r of rows) {
            const p = extractNoteTag(r.notes, "PLAT");
            if (p && !plates.includes(p)) plates.push(p);
            if (plates.length >= 10) break;
        }

        return NextResponse.json({
            data: {
                mode: parsed.mode,
                phone,
                name,
                visitCount: rows.length,
                lastVisit: rows[0].transactionDate,
                plates,
            },
        });
    } catch (error) {
        console.error("GET /api/unit-layanan/customer-lookup error:", error);
        return NextResponse.json({ message: "Gagal mencari data pelanggan" }, { status: 500 });
    }
}
