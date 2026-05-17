import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";

const ALLOWED_ROLES = ["operator", "admin", "admin_sp", "super_admin"];

// Strip common Indonesian titles for name normalization
function normalizeName(name: string): string {
  return name
    .replace(/^(H\.|Hj\.|Dr\.|Drs\.|Ir\.|Prof\.|S\.H\.|S\.Pd\.|S\.T\.|S\.E\.|S\.Sos\.|S\.Kom\.|M\.H\.|M\.T\.|M\.Sc\.|A\.Md\.)\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// GET /api/members/duplicates — Detect potential duplicate members
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !ALLOWED_ROLES.includes(session.user.role)) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const members = await prisma.member.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        nrp: true,
        name: true,
        memberNo: true,
        status: true,
        createdAt: true,
        _count: {
          select: {
            loans: true,
            savingsAccounts: true,
            unitTransactions: true,
            storeSales: true,
          },
        },
      },
    });

    const nrpGroups = new Map<string, typeof members>();
    const nameGroups = new Map<string, typeof members>();

    for (const m of members) {
      if (m.nrp && m.nrp.trim()) {
        const key = m.nrp.trim();
        if (!nrpGroups.has(key)) nrpGroups.set(key, []);
        nrpGroups.get(key)!.push(m);
      }

      const normalName = normalizeName(m.name);
      if (normalName.length >= 3) {
        if (!nameGroups.has(normalName)) nameGroups.set(normalName, []);
        nameGroups.get(normalName)!.push(m);
      }
    }

    const groups: Array<{
      key: string;
      type: "nrp" | "name";
      members: Array<{
        id: number;
        nrp: string | null;
        name: string;
        memberNo: string;
        status: string;
        hasLoans: boolean;
        hasSavings: boolean;
        hasTransactions: boolean;
        createdAt: string;
      }>;
    }> = [];

    // Process NRP groups (higher priority)
    for (const [key, groupMembers] of nrpGroups) {
      if (groupMembers.length <= 1) continue;
      groups.push({
        key,
        type: "nrp",
        members: groupMembers.map((m) => ({
          id: m.id,
          nrp: m.nrp,
          name: m.name,
          memberNo: m.memberNo,
          status: m.status,
          hasLoans: m._count.loans > 0,
          hasSavings: m._count.savingsAccounts > 0,
          hasTransactions: m._count.unitTransactions + m._count.storeSales > 0,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    // Process name groups (exclude members already in NRP groups)
    const nrpGroupIds = new Set(groups.flatMap((g) => g.members.map((m) => m.id)));
    for (const [key, groupMembers] of nameGroups) {
      if (groupMembers.length <= 1) continue;
      const filtered = groupMembers.filter((m) => !nrpGroupIds.has(m.id));
      if (filtered.length <= 1) continue;

      groups.push({
        key,
        type: "name",
        members: filtered.map((m) => ({
          id: m.id,
          nrp: m.nrp,
          name: m.name,
          memberNo: m.memberNo,
          status: m.status,
          hasLoans: m._count.loans > 0,
          hasSavings: m._count.savingsAccounts > 0,
          hasTransactions: m._count.unitTransactions + m._count.storeSales > 0,
          createdAt: m.createdAt.toISOString(),
        })),
      });
    }

    return NextResponse.json({ groups, totalGroups: groups.length });
  } catch (error) {
    console.error("GET /api/members/duplicates error:", error);
    return NextResponse.json(
      { message: "Failed to detect duplicates" },
      { status: 500 }
    );
  }
}
