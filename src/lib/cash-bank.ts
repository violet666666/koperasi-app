type AccountType = "cash" | "bank";

/**
 * 3-step fallback lookup for a unit's CashBankAccount.
 *
 * 1. Check `unitTypes` JSON array (multi-unit accounts, e.g. ["fitness", "toko"])
 * 2. Check `unitType` single string field (legacy single-unit accounts)
 * 3. Check generic operational account (`unitType: null, purpose: "operasional"`)
 *
 * Must be called inside a Prisma $transaction — receives the `tx` delegate.
 */
export async function findUnitAccount(
    tx: any,
    unitType: string,
    accountType: AccountType,
): Promise<{ id: number; currentBalance: any } | null> {
    // Step 1: Multi-unit match (unitTypes array_contains)
    let account = await tx.cashBankAccount.findFirst({
        where: {
            type: accountType,
            isActive: true,
            unitTypes: { array_contains: unitType } as any,
        },
        orderBy: { id: "asc" },
    });

    // Step 2: Single unitType match
    if (!account) {
        account = await tx.cashBankAccount.findFirst({
            where: { type: accountType, unitType, isActive: true },
            orderBy: { id: "asc" },
        });
    }

    // Step 3: Generic operational account (no unitType)
    if (!account) {
        account = await tx.cashBankAccount.findFirst({
            where: { type: accountType, unitType: null, purpose: "operasional", isActive: true },
            orderBy: { id: "asc" },
        });
    }

    return account;
}
