import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const repo = resolve(__dirname, "../..");
const read = (path: string) => readFileSync(resolve(repo, path), "utf8");

describe("mobile QA regression contracts", () => {
  it("defines the asset detail refresh function used after dispose", () => {
    const source = read("mobile/src/screens/operator/AsetDetailScreen.tsx");
    expect(source).toMatch(/const fetchAssetDetail = (?:React\.)?useCallback/);
    expect(source).toContain("await fetchAssetDetail()");
  });

  it("uses /api/mobile paths for every piutang-gabungan request", () => {
    const source = read("mobile/src/screens/operator/LaporanPiutangGabunganScreen.tsx");
    expect(source).not.toMatch(/([`'"])\/mobile\/reports\/piutang-gabungan/);
    expect(source.match(/\/api\/mobile\/reports\/piutang-gabungan/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("uses dedicated mobile routes for Arus Kas and Faktur Potongan", () => {
    const arus = read("mobile/src/screens/operator/ArusKasScreen.tsx");
    const faktur = read("mobile/src/screens/operator/FakturPotonganScreen.tsx");
    const apiClient = read("mobile/src/lib/api.ts");
    expect(arus).toContain("/api/mobile/reports/arus-kas");
    expect(faktur).toContain("/api/mobile/reports/faktur-potongan");
    expect(apiClient).toContain("/api/mobile/reports/arus-kas");
    expect(apiClient).toContain("/api/mobile/reports/faktur-potongan");
    expect(read("src/app/api/mobile/reports/arus-kas/route.ts")).toContain("getMobileUser");
    expect(read("src/app/api/mobile/reports/faktur-potongan/route.ts")).toContain("getMobileUser");
  });

  it("reads talangan stats from the list response", () => {
    const source = read("mobile/src/screens/operator/HajiUmrahTalanganScreen.tsx");
    expect(source).toContain("setStats(listRes.data.stats || null)");
    expect(source).not.toContain("setStats(statsRes.data.data");
  });

  it("returns totalPages in mobile loan applications pagination", () => {
    const source = read("src/app/api/mobile/loans/applications/route.ts");
    expect(source).toContain("prisma.loanApplication.count({ where })");
    expect(source).toMatch(/totalPages:\s*Math\.max\(1, Math\.ceil\(total \/ perPage\)\)/);
  });

  it("uses mobile member detail routes and provides their handlers", () => {
    const screen = read("mobile/src/screens/operator/MemberDetailScreen.tsx");
    expect(screen).toContain("/api/mobile/members/${memberId}/piutang-barang");
    expect(screen).toContain("/api/mobile/members/${memberId}/transactions");
    expect(read("src/app/api/mobile/members/[id]/piutang-barang/route.ts")).toContain("getMobileUserWithScope");
    expect(read("src/app/api/mobile/members/[id]/transactions/route.ts")).toContain("getMobileUserWithScope");
  });

  it.each([
    "src/app/api/mobile/kas-bank/transactions/route.ts",
    "src/app/api/mobile/kas-bank/transfers/route.ts",
    "src/app/api/mobile/loans-operator/direct-disburse/route.ts",
    "src/app/api/mobile/loans-operator/kompen-disburse/route.ts",
  ])("writes an audit event in %s", (path) => {
    const source = read(path);
    expect(source).toContain('from "@/lib/audit-logger"');
    expect(source).toContain("await logAudit({");
  });
});