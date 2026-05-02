import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CONFIG_KEY = "playstation_console_config";

async function main() {
    // Seed default console configuration
    const defaultConfig = {
        consoles: Array.from({ length: 8 }, (_, i) => ({
            id: `TV-${i + 1}`,
            label: `TV ${i + 1} (PS5)`,
            type: "PS5",
        })),
        ratePerBlock: 3750,
        blockDurationMins: 15,
    };

    await prisma.appSetting.upsert({
        where: { key: CONFIG_KEY },
        update: {},
        create: {
            key: "playstation_console_config",
            value: JSON.stringify(defaultConfig),
            label: "PlayStation Console Configuration",
        },
    });

    console.log("Default PS console config seeded.");

    // Update rental product price from hourly to per-block rate
    const rentalProduct = await prisma.storeProduct.findFirst({
        where: { unitType: "playstation", isService: true },
    });

    if (rentalProduct) {
        const currentPrice = Number(rentalProduct.sellPrice);
        const perBlockRate = Math.round(currentPrice / 4);
        await prisma.storeProduct.update({
            where: { id: rentalProduct.id },
            data: { sellPrice: perBlockRate },
        });
        console.log(`Rental product "${rentalProduct.name}" price updated: ${currentPrice} → ${perBlockRate} (per 15-min block)`);
    } else {
        console.log("No rental product found for playstation. Skipping price migration.");
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
