import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { logAudit, extractRequestInfo, extractUserFromSession } from "@/lib/audit-logger";

// DELETE /api/toko/products/reset — Hapus semua produk toko (soft-delete)
export async function DELETE(request: Request) {
    try {
        // Count existing products first
        const count = await prisma.storeProduct.count({
            where: { deletedAt: null },
        });

        if (count === 0) {
            return NextResponse.json({
                message: "Tidak ada produk untuk dihapus.",
                data: { deleted: 0 },
            });
        }

        // Check if any products have active sale items
        const productsWithSales = await prisma.storeSaleItem.count();
        
        if (productsWithSales > 0) {
            // Soft delete (set deletedAt) — products with sales history cannot be hard-deleted
            await prisma.storeProduct.updateMany({
                where: { deletedAt: null },
                data: { deletedAt: new Date(), isActive: false },
            });
        } else {
            // Hard delete if no sale items reference them
            await prisma.storeProduct.deleteMany({});
        }

        // Audit log
        try {
            const session = await auth();
            const reqInfo = extractRequestInfo(request);
            const userInfo = extractUserFromSession(session);
            await logAudit({
                ...userInfo, ...reqInfo,
                action: "DELETE", module: "Toko",
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
