import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getMobileUser, unauthorizedResponse } from "../../../middleware";

// GET /api/mobile/haji-umrah/talangan/gap — Gap calculator per rekening
// Mirror of web GET /api/haji-umrah/talangan/gap (auth swapped for mobile JWT).
export async function GET(request: Request) {
    const user = getMobileUser(request);
    if (!user) return unauthorizedResponse();

    // Staff-only gate
    if (user.role !== "operator" && user.role !== "admin" && user.role !== "admin_sp") {
        return NextResponse.json({ message: "Akses ditolak" }, { status: 403 });
    }

    try {
        const { searchParams } = new URL(request.url);
        const onlyWithGap = searchParams.get("onlyWithGap") === "true";
        const productType = searchParams.get("productType") || ""; // tabungan_haji | tabungan_umrah

        // Build where clause
        const whereClause: Record<string, unknown> = {
            status: "active",
            product: { type: { in: ["tabungan_haji", "tabungan_umrah"] } },
        };
        if (productType) {
            (whereClause.product as Record<string, unknown>).type = productType;
        }

        const accounts = await prisma.savingsAccount.findMany({
            where: whereClause,
            include: {
                member: { select: { id: true, name: true, nrp: true } },
                product: { select: { id: true, code: true, name: true, type: true } },
                talanganLoans: {
                    where: { status: "active" },
                    select: { id: true, loanNo: true, principalOutstanding: true },
                },
            },
            orderBy: { createdAt: "desc" },
        });

        const data = accounts
            .map((account) => {
                const balance = Number(account.balance);
                const target = account.targetAmount ? Number(account.targetAmount) : 0;
                const gap = Math.max(0, target - balance);
                const progress = target > 0 ? Math.min(100, (balance / target) * 100) : 0;
                const hasActiveTalangan = account.talanganLoans.length > 0;

                let status: string;
                if (!account.targetAmount) {
                    status = "no_target";
                } else if (progress >= 100) {
                    status = "target_reached";
                } else if (hasActiveTalangan) {
                    status = "has_talangan";
                } else {
                    status = "needs_talangan";
                }

                return {
                    accountId: account.id,
                    accountNo: account.accountNo,
                    memberId: account.member.id,
                    memberName: account.member.name,
                    memberNrp: account.member.nrp,
                    productType: account.product.type,
                    productName: account.product.name,
                    balance,
                    targetAmount: target,
                    gap,
                    progress: Math.round(progress * 10) / 10,
                    hasActiveTalangan,
                    activeTalanganId: hasActiveTalangan ? account.talanganLoans[0].id : null,
                    activeTalanganOutstanding: hasActiveTalangan
                        ? Number(account.talanganLoans[0].principalOutstanding)
                        : null,
                    status,
                };
            })
            .filter((a) => {
                if (onlyWithGap) {
                    return a.status === "needs_talangan";
                }
                return true;
            });

        const summary = {
            totalAccounts: accounts.length,
            withGap: accounts.filter((a) => {
                const t = a.targetAmount ? Number(a.targetAmount) : 0;
                return t > Number(a.balance) && a.talanganLoans.length === 0;
            }).length,
            coveredByTalangan: accounts.filter((a) => a.talanganLoans.length > 0).length,
            targetReached: accounts.filter((a) => {
                const t = a.targetAmount ? Number(a.targetAmount) : 0;
                return t > 0 && Number(a.balance) >= t;
            }).length,
        };

        return NextResponse.json({ data, summary });
    } catch (error) {
        console.error("GET /api/mobile/haji-umrah/talangan/gap error:", error);
        return NextResponse.json({ message: "Failed to calculate gap" }, { status: 500 });
    }
}
