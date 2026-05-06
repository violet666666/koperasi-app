import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { createAccountSchema, paginationSchema } from "@/lib/validations";
import { getCached, invalidateCache } from "@/lib/cache";

// GET /api/master/accounts - Chart of Accounts
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const format = searchParams.get("format") || "flat"; // flat or tree
        const type = searchParams.get("type"); // filter by type

        const cacheKey = `accounts:${format}:${type || "all"}`;
        const data = await getCached(cacheKey, 5 * 60 * 1000, async () => {
            const where = {
                deletedAt: null,
                ...(type && { type }),
            };

            const accounts = await prisma.account.findMany({
                where,
                orderBy: { code: "asc" },
            });

            if (format === "tree") {
                const accountMap = new Map<number, any>();
                const rootAccounts: any[] = [];

                accounts.forEach((acc) => {
                    accountMap.set(acc.id, { ...acc, children: [] });
                });

                accounts.forEach((acc) => {
                    const node = accountMap.get(acc.id);
                    if (acc.parentId) {
                        const parent = accountMap.get(acc.parentId);
                        if (parent) {
                            parent.children.push(node);
                        }
                    } else {
                        rootAccounts.push(node);
                    }
                });

                return rootAccounts;
            }

            return accounts;
        });

        return NextResponse.json({ data });
    } catch (error) {
        console.error("GET /api/master/accounts error:", error);
        return NextResponse.json(
            { message: "Failed to fetch accounts" },
            { status: 500 }
        );
    }
}

// POST /api/master/accounts
export async function POST(request: Request) {
    try {
        const body = await request.json();
        const data = createAccountSchema.parse(body);

        const existing = await prisma.account.findUnique({
            where: { code: data.code },
        });

        if (existing) {
            return NextResponse.json(
                { message: "Kode akun sudah digunakan" },
                { status: 400 }
            );
        }

        // Auto-determine level from parent
        let level = 1;
        if (data.parentId) {
            const parent = await prisma.account.findUnique({
                where: { id: data.parentId },
            });
            if (parent) {
                level = parent.level + 1;
            }
        }

        const account = await prisma.account.create({
            data: {
                ...data,
                level,
            },
        });

        invalidateCache("accounts:");

        return NextResponse.json({ data: account }, { status: 201 });
    } catch (error) {
        console.error("POST /api/master/accounts error:", error);
        if (error instanceof Error && error.name === "ZodError") {
            return NextResponse.json(
                { message: "Validation error", errors: error },
                { status: 400 }
            );
        }
        return NextResponse.json(
            { message: "Failed to create account" },
            { status: 500 }
        );
    }
}
