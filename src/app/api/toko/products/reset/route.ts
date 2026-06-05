import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";
import { storeSaleUnitTypeFilter } from "@/lib/constants/units";

// DELETE /api/toko/products/reset — Hapus semua produk toko (soft-delete) — admin/operator only
export async function DELETE(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const role = session.user.role as string;
        if (role === "kasir") {
            return NextResponse.json({ message: "Kasir tidak diizinkan menghapus semua produk" }, { status: 403 });
        }

        // Count existing products first — filter by unit
        const unitType = (session.user as any).unitType || "toko";
        const count = await prisma.storeProduct.count({
            where: { deletedAt: null, unitType: storeSaleUnitTypeFilter(unitType) },
        });

        if (count === 0) {
            return NextResponse.json({
                message: "Tidak ada produk untuk dihapus.",
                data: { deleted: 0 },
            });
        }

        // Check if any products in this unit have active sale items
        const unitProductIds = await prisma.storeProduct.findMany({
            where: { deletedAt: null, unitType: storeSaleUnitTypeFilter(unitType) },
            select: { id: true },
        });
        const productIdList = unitProductIds.map(p => p.id);
        const productsWithSales = await prisma.storeSaleItem.count({
            where: { productId: { in: productIdList } },
        });

        if (productsWithSales > 0) {
            // Soft delete (set deletedAt) — products with sales history cannot be hard-deleted
            await prisma.storeProduct.updateMany({
                where: { id: { in: productIdList } },
                data: { deletedAt: new Date(), isActive: false },
            });
        } else {
            // Hard delete if no sale items reference them
            await prisma.storeProduct.deleteMany({
                where: { id: { in: productIdList } },
            });
        }

        // Audit log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "DELETE", module: "Toko", unitType: "toko",
                description: `Reset semua produk toko: ${count} produk dihapus.`,
                newData: { deleted: count, method: productsWithSales > 0 ? "soft_delete" : "hard_delete" },
            });
        } catch (e) { /* audit silent */ }

        return NextResponse.json({
            message: `Berhasil menghapus ${count} produk. Silakan import ulang data yang benar.`,
            data: { deleted: count },
        });
    } catch (error: any) {
        console.error("DELETE /api/toko/products/reset error:", error);
        return NextResponse.json(
            { message: "Gagal menghapus produk: " + (error?.message || "Unknown") },
            { status: 500 }
        );
    }
}
