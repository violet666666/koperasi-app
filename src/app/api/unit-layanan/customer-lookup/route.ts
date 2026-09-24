import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { extractNoteTag, normalizePhone } from "@/lib/services/unit-notes";

// GET /api/unit-layanan/customer-lookup?phone=08123456
// Cari pelanggan cuci mobil berdasarkan no. HP (prefix-match, min 8 digit).
// Sumber: UnitTransaction.notes tag [HP:] — tanpa tabel/model baru.
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
        const phone = normalizePhone(searchParams.get("phone"));
        if (phone.length < 8) {
            return NextResponse.json({ data: null });
        }

        // Prefix-match: `[HP:0812` cocok utk [HP:081234567890] — memungkinkan suggest saat mengetik.
        const rows = await prisma.unitTransaction.findMany({
            where: {
                unitType: "cuci_mobil",
                status: { not: "voided" },
                notes: { contains: `[HP:${phone}` },
            },
            orderBy: { createdAt: "desc" },
            take: 500,
            select: { notes: true, transactionDate: true, createdAt: true },
        });

        if (rows.length === 0) {
            return NextResponse.json({ data: null });
        }

        // Ambil no. HP lengkap dari baris terbaru (input bisa prefix).
        const fullPhone = extractNoteTag(rows[0].notes, "HP") || phone;
        const name = rows.map(r => extractNoteTag(r.notes, "NAMA")).find(Boolean) || null;
        const plates: string[] = [];
        for (const r of rows) {
            const p = extractNoteTag(r.notes, "PLAT");
            if (p && !plates.includes(p)) plates.push(p);
            if (plates.length >= 3) break;
        }

        return NextResponse.json({
            data: {
                phone: fullPhone,
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
