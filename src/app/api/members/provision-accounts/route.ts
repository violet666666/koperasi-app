import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// POST /api/members/provision-accounts
// Otomatis buka rekening simpanan (Pokok, Wajib, Sukarela) untuk semua anggota aktif yang belum punya
export async function POST(request: Request) {
    try {
        // Ambil semua produk simpanan aktif
        const products = await prisma.savingsProduct.findMany({
            where: { isActive: true, deletedAt: null },
            orderBy: { id: "asc" },
        });

        if (products.length === 0) {
            return NextResponse.json(
                { message: "Belum ada produk simpanan yang aktif. Silakan buat di Master > Produk Simpanan." },
                { status: 400 }
            );
        }

        // Ambil semua anggota aktif
        const members = await prisma.member.findMany({
            where: { status: "active", deletedAt: null },
            select: { id: true, branchId: true, memberNo: true, name: true },
        });

        // Ambil semua rekening yang sudah ada
        const existingAccounts = await prisma.savingsAccount.findMany({
            select: { memberId: true, productId: true },
        });

        // Set untuk lookup cepat
        const existingSet = new Set(
            existingAccounts.map((a) => `${a.memberId}-${a.productId}`)
        );

        // Kumpulkan data rekening yang perlu dibuat
        const toCreate: {
            accountNo: string;
            memberId: number;
            productId: number;
            branchId: number;
            balance: number;
            openedDate: Date;
        }[] = [];

        const now = new Date();

        for (const member of members) {
            for (const product of products) {
                const key = `${member.id}-${product.id}`;
                if (!existingSet.has(key)) {
                    toCreate.push({
                        accountNo: `SAV-${member.id}-${product.id}`,
                        memberId: member.id,
                        productId: product.id,
                        branchId: member.branchId,
                        balance: 0,
                        openedDate: now,
                    });
                }
            }
        }

        if (toCreate.length === 0) {
            return NextResponse.json({
                message: "Semua anggota sudah memiliki rekening simpanan lengkap.",
                data: { created: 0, totalMembers: members.length, totalProducts: products.length },
            });
        }

        // Batch create
        const BATCH = 100;
        let totalCreated = 0;
        for (let i = 0; i < toCreate.length; i += BATCH) {
            const batch = toCreate.slice(i, i + BATCH);
            const result = await prisma.savingsAccount.createMany({
                data: batch,
                skipDuplicates: true,
            });
            totalCreated += result.count;
        }

        // Audit
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo,
                ...reqInfo,
                action: "CREATE",
                module: "Simpanan",
                description: `Provision rekening simpanan otomatis: ${totalCreated} rekening baru untuk ${members.length} anggota.`,
                newData: { totalCreated, totalMembers: members.length, products: products.map((p) => p.name) },
            });
        } catch (e) { /* audit log failure must not break response */ }

        return NextResponse.json({
            message: `Berhasil membuka ${totalCreated} rekening simpanan baru.`,
            data: {
                created: totalCreated,
                totalMembers: members.length,
                totalProducts: products.length,
                productNames: products.map((p) => `${p.name} (${p.type})`),
            },
        });
    } catch (error: any) {
        console.error("POST /api/members/provision-accounts error:", error);
        return NextResponse.json(
            { message: "Gagal membuat rekening simpanan: " + (error?.message || "Unknown error") },
            { status: 500 }
        );
    }
}
