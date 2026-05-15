import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { validateOpnameItems } from "@/lib/stock-opname";

// POST /api/toko/stock-tracking/opname
// Process stock opname: save counts and create adjustment movements
export async function POST(request: Request) {
    try {
        const session = await auth();
        if (!session?.user?.id) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        const userRole =
            typeof session.user.role === "string"
                ? session.user.role
                : (session.user.role as { name: string })?.name;

        if (!["admin", "operator"].includes(userRole)) {
            return NextResponse.json({ message: "Forbidden" }, { status: 403 });
        }

        const unitType = (session.user.unitType as string) || "toko";
        const userId = parseInt(session.user.id);
        const body = await request.json();
        const { items, location } = body as {
            items: { productId: number; physicalStock: number }[];
            location: string;
        };

        const validation = validateOpnameItems(items);
        if (!validation.valid) {
            return NextResponse.json(
                { message: validation.errors.join(", ") },
                { status: 400 }
            );
        }

        const stockLocation = location === "toko" ? "toko" : "gudang";
        const productIds = items.map((i) => i.productId);

        const products = await prisma.storeProduct.findMany({
            where: { id: { in: productIds }, unitType },
            select: {
                id: true,
                name: true,
                stockGdg: true,
                stockToko: true,
            },
        });

        const productMap = new Map(products.map((p) => [p.id, p]));

        const results = [];
        for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product) continue;

            const systemStock =
                stockLocation === "gudang"
                    ? product.stockGdg
                    : product.stockToko;
            const difference = item.physicalStock - systemStock;

            if (difference === 0) {
                results.push({
                    productId: product.id,
                    name: product.name,
                    status: "sesuai",
                    difference: 0,
                });
                continue;
            }

            const adjustmentType = difference > 0 ? "in" : "out";
            const qty = Math.abs(difference);

            await prisma.$transaction(async (tx) => {
                await tx.storeStockMovement.create({
                    data: {
                        productId: product.id,
                        type: adjustmentType,
                        quantity: qty,
                        reason: "opname",
                        notes: `Opname stok: sistem=${systemStock}, fisik=${item.physicalStock}`,
                        operatorId: userId,
                        status: "active",
                    },
                });

                const updateData =
                    stockLocation === "gudang"
                        ? { stockGdg: item.physicalStock }
                        : { stockToko: item.physicalStock };

                await tx.storeProduct.update({
                    where: { id: product.id },
                    data: updateData,
                });
            });

            results.push({
                productId: product.id,
                name: product.name,
                status: difference > 0 ? "lebih" : "kurang",
                difference,
                adjustmentType,
                qty,
            });
        }

        const summary = {
            totalChecked: results.length,
            matched: results.filter((r) => r.status === "sesuai").length,
            adjusted: results.filter((r) => r.status !== "sesuai").length,
        };

        return NextResponse.json({ results, summary });
    } catch (error) {
        console.error("[stock-tracking/opname] Error:", error);
        return NextResponse.json(
            { message: "Gagal menyimpan opname" },
            { status: 500 }
        );
    }
}
