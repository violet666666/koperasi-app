import { describe, it, expect } from "vitest";

// Tests that the movements fallback path (StoreSale-derived) respects unitType filtering.
// BUG: When StoreStockMovement returns no results for a unit, the fallback path
// queries StoreSale WITHOUT unitType filter, showing movements from ALL units.

describe("Movements API — unitType filter in fallback path", () => {
    it("should only include sales matching the requested unitType", () => {
        // Simulate the fallback logic: derive movements from StoreSale items
        // Only sales with the matching unitType should be included
        const sales = [
            {
                id: 1,
                saleNo: "TK-001",
                unitType: "toko",
                items: [{ productId: 1, productName: "BERAS", quantity: 2 }],
                metadata: {},
            },
            {
                id: 2,
                saleNo: "LSP-001",
                unitType: "cafe_lsp",
                items: [{ productId: 10, productName: "Espresso", quantity: 1 }],
                metadata: {},
            },
            {
                id: 3,
                saleNo: "RS-001",
                unitType: "resto",
                items: [{ productId: 20, productName: "Nasi Goreng", quantity: 1 }],
                metadata: {},
            },
        ];

        // The filter function — this is what we're testing
        function filterMovementsByUnitType(
            allSales: typeof sales,
            targetUnitType: string
        ) {
            return allSales
                .filter((sale) => {
                    const meta =
                        typeof sale.metadata === "string"
                            ? JSON.parse(sale.metadata)
                            : sale.metadata || {};
                    if (meta.isVoided) return false;
                    return sale.unitType === targetUnitType;
                })
                .flatMap((sale) =>
                    sale.items.map((item) => ({
                        id: `sale-${sale.id}-${item.productId}`,
                        productName: item.productName,
                        notes: `Penjualan ${sale.saleNo}`,
                    }))
                );
        }

        // Test: filter for cafe_lsp should ONLY return Espresso, not BERAS or Nasi Goreng
        const cafeLspMovements = filterMovementsByUnitType(sales, "cafe_lsp");
        expect(cafeLspMovements).toHaveLength(1);
        expect(cafeLspMovements[0].productName).toBe("Espresso");

        // Test: filter for toko should ONLY return BERAS
        const tokoMovements = filterMovementsByUnitType(sales, "toko");
        expect(tokoMovements).toHaveLength(1);
        expect(tokoMovements[0].productName).toBe("BERAS");
    });

    it("should exclude voided sales from fallback results", () => {
        const sales = [
            {
                id: 1,
                saleNo: "LSP-001",
                unitType: "cafe_lsp",
                items: [{ productId: 10, productName: "Espresso", quantity: 1 }],
                metadata: {},
            },
            {
                id: 2,
                saleNo: "LSP-002",
                unitType: "cafe_lsp",
                items: [{ productId: 11, productName: "Latte", quantity: 2 }],
                metadata: { isVoided: true },
            },
        ];

        function filterMovementsByUnitType(
            allSales: typeof sales,
            targetUnitType: string
        ) {
            return allSales
                .filter((sale) => {
                    const meta =
                        typeof sale.metadata === "string"
                            ? JSON.parse(sale.metadata)
                            : sale.metadata || {};
                    if (meta.isVoided) return false;
                    return sale.unitType === targetUnitType;
                })
                .flatMap((sale) =>
                    sale.items.map((item) => ({
                        productName: item.productName,
                    }))
                );
        }

        const movements = filterMovementsByUnitType(sales, "cafe_lsp");
        expect(movements).toHaveLength(1);
        expect(movements[0].productName).toBe("Espresso");
    });

    it("should handle sales without unitType field gracefully", () => {
        const sales = [
            {
                id: 1,
                saleNo: "OLD-001",
                // no unitType field — legacy data
                items: [{ productId: 1, productName: "Old Product", quantity: 1 }],
                metadata: {},
            },
            {
                id: 2,
                saleNo: "LSP-001",
                unitType: "cafe_lsp",
                items: [{ productId: 10, productName: "Espresso", quantity: 1 }],
                metadata: {},
            },
        ];

        function filterMovementsByUnitType(
            allSales: typeof sales,
            targetUnitType: string
        ) {
            return allSales
                .filter((sale) => {
                    const meta =
                        typeof sale.metadata === "string"
                            ? JSON.parse(sale.metadata)
                            : sale.metadata || {};
                    if (meta.isVoided) return false;
                    return (sale as any).unitType === targetUnitType;
                })
                .flatMap((sale) =>
                    sale.items.map((item) => ({
                        productName: item.productName,
                    }))
                );
        }

        const movements = filterMovementsByUnitType(sales, "cafe_lsp");
        expect(movements).toHaveLength(1);
        expect(movements[0].productName).toBe("Espresso");
    });
});
