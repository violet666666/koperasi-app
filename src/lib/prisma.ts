import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
    prismaRead: PrismaClient | undefined;
};

function createTCPClient() {
    return new PrismaClient({
        log: process.env.NODE_ENV === "development"
            ? ["query", "error", "warn"]
            : ["error"],
        datasources: { db: { url: process.env.DATABASE_URL } },
    });
}

// TCP client — for writes and $transaction (47 routes depend on this)
export const prisma = globalForPrisma.prisma ?? createTCPClient();

// HTTP client — for read-only Prisma ORM queries (faster cold starts on Vercel)
// Falls back to TCP in development or if adapter unavailable
// IMPORTANT: Does NOT support $queryRaw, $transaction, or write operations
export const prismaRead: PrismaClient = (() => {
    if (globalForPrisma.prismaRead) return globalForPrisma.prismaRead;

    if (process.env.VERCEL) {
        try {
            const { PrismaNeonHTTP } = require("@prisma/adapter-neon");
            const { neon } = require("@neondatabase/serverless");
            const sql = neon(process.env.DATABASE_URL!);
            const adapter = new PrismaNeonHTTP(sql);
            const client = new PrismaClient({ adapter, log: ["error"] });
            globalForPrisma.prismaRead = client;
            return client;
        } catch {
            const client = createTCPClient();
            globalForPrisma.prismaRead = client;
            return client;
        }
    }

    const client = createTCPClient();
    globalForPrisma.prismaRead = client;
    return client;
})();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
    globalForPrisma.prismaRead = prismaRead;
}

export default prisma;
