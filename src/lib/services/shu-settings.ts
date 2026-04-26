import prisma from "@/lib/prisma";

const DEFAULT_CARWASH_BONUS = 2000;

let cachedCarwashBonus: number | null = null;
let cacheExpiry = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getCarwashBonusPerTx(): Promise<number> {
    const now = Date.now();
    if (cachedCarwashBonus !== null && now < cacheExpiry) {
        return cachedCarwashBonus;
    }

    try {
        const setting = await prisma.systemSetting.findUnique({ where: { id: "global" } });
        if (setting?.shuConfig) {
            const config = setting.shuConfig as Record<string, unknown>;
            cachedCarwashBonus = typeof config.carwashBonusPerTx === "number"
                ? config.carwashBonusPerTx
                : DEFAULT_CARWASH_BONUS;
        } else {
            cachedCarwashBonus = DEFAULT_CARWASH_BONUS;
        }
    } catch {
        cachedCarwashBonus = DEFAULT_CARWASH_BONUS;
    }

    cacheExpiry = now + CACHE_TTL;
    return cachedCarwashBonus;
}

export function clearShuSettingsCache() {
    cachedCarwashBonus = null;
    cacheExpiry = 0;
}
