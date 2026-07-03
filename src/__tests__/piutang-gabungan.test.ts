import { describe, it, expect } from "vitest";
import { aggregatePiutangGabungan, TOKO_UNIT_TYPES, buildPiutangCSV } from "@/lib/services/piutang-gabungan";

const m = (id: number, over: Partial<any> = {}) => ({
  id, name: `Anggota ${id}`, nrp: `NRP${id}`, memberNo: `M${id}`,
  pangkat: "Sertu", category: null, kesatuan: "Yon A", ...over,
});

describe("aggregatePiutangGabungan", () => {
  it("toko salary_cut (toko-family unitType) → piutangToko only", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: 1, unitType: "resto_cafe", _sum: { amount: 50000 } }],
      activeLoans: [],
    });
    expect(r.piutangList).toHaveLength(1);
    expect(r.piutangList[0].id).toBe(1);
    expect(r.piutangList[0].piutangToko).toBe(50000);
    expect(r.piutangList[0].piutangUnit).toBe(0);
    expect(r.totalPiutangToko).toBe(50000);
    expect(r.totalPiutangUnit).toBe(0);
  });

  it("non-toko unitType → piutangUnit only", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: 1, unitType: "cuci_mobil", _sum: { amount: 30000 } }],
      activeLoans: [],
    });
    expect(r.piutangList[0].piutangUnit).toBe(30000);
    expect(r.piutangList[0].piutangToko).toBe(0);
  });

  it("active loan → spPokok+spJasa + angsuranKe `${n}/${tenor}`", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [{ memberId: 1, loanNo: "L1", principalOutstanding: 100000, interestOutstanding: 20000, tenorMonths: 10, disbursementDate: null, schedules: [{ installmentNo: 3 }] }],
    });
    expect(r.piutangList[0].piutangSPPokok).toBe(100000);
    expect(r.piutangList[0].piutangSPJasa).toBe(20000);
    expect(r.piutangList[0].angsuranKe).toBe("3/10");
    expect(r.piutangList[0].loanCount).toBe(1);
  });

  it("multiple loans on same member → accumulate pokok+jasa+loanCount", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [
        { memberId: 1, loanNo: "L1", principalOutstanding: 100000, interestOutstanding: 20000, tenorMonths: 10, disbursementDate: null, schedules: [{ installmentNo: 3 }] },
        { memberId: 1, loanNo: "L2", principalOutstanding: 50000, interestOutstanding: 10000, tenorMonths: 5, disbursementDate: null, schedules: [{ installmentNo: 2 }] },
      ],
    });
    expect(r.piutangList[0].piutangSPPokok).toBe(150000);
    expect(r.piutangList[0].piutangSPJasa).toBe(30000);
    expect(r.piutangList[0].loanCount).toBe(2);
  });

  it("member with zero piutang is excluded", () => {
    const r = aggregatePiutangGabungan({ members: [m(1), m(2)], unitTxAgg: [], activeLoans: [] });
    expect(r.piutangList).toHaveLength(0);
    expect(r.totalAnggota).toBe(0);
  });

  it("loan with zero outstanding is skipped", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [],
      activeLoans: [{ memberId: 1, loanNo: "L0", principalOutstanding: 0, interestOutstanding: 0, tenorMonths: 10, disbursementDate: null, schedules: [] }],
    });
    expect(r.piutangList).toHaveLength(0);
  });

  it("totals = sum over included members; seq increments only for included", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1), m(2), m(3)],
      unitTxAgg: [
        { memberId: 1, unitType: "toko", _sum: { amount: 10000 } },
        { memberId: 3, unitType: "cuci_mobil", _sum: { amount: 40000 } },
      ],
      activeLoans: [],
    });
    expect(r.piutangList.map((p) => p.seq)).toEqual([1, 2]);
    expect(r.grandTotal).toBe(50000);
  });

  it("nrp falls back to memberNo when nrp null; pangkat falls back to category then '-'", () => {
    const r = aggregatePiutangGabungan({
      members: [{ id: 1, name: "X", nrp: null, memberNo: "M999", pangkat: null, category: "PNS", kesatuan: null }],
      unitTxAgg: [{ memberId: 1, unitType: "toko", _sum: { amount: 1000 } }],
      activeLoans: [],
    });
    expect(r.piutangList[0].nrp).toBe("M999");
    expect(r.piutangList[0].pangkat).toBe("PNS");
    expect(r.piutangList[0].kesatuan).toBe("-");
  });

  it("null memberId rows are skipped", () => {
    const r = aggregatePiutangGabungan({
      members: [m(1)],
      unitTxAgg: [{ memberId: null, unitType: "toko", _sum: { amount: 999 } }],
      activeLoans: [],
    });
    expect(r.piutangList).toHaveLength(0);
  });
});

describe("buildPiutangCSV", () => {
  const agg: any = {
    piutangList: [], totalAnggota: 1,
    totalPiutangToko: 10000, totalPiutangUnit: 0,
    totalPiutangSPPokok: 0, totalPiutangSPJasa: 0, grandTotal: 10000,
  };
  const item: any = { seq: 1, nama: "Budi", nrp: "123", pangkat: "Sertu", kesatuan: "Yon A",
    piutangToko: 10000, piutangUnit: 0, piutangSPPokok: 0, piutangSPJasa: 0, totalPiutang: 10000,
    angsuranKe: "-", loanCount: 0 };

  it("has the exact header row", () => {
    const csv = buildPiutangCSV([item], agg);
    const firstLine = csv.split("\n")[0];
    expect(firstLine).toBe("No,NRP,Pangkat,Kesatuan,Nama,Piutang Toko,Piutang Unit,Pokok Pinjaman,Jasa Pinjaman,Total Piutang");
  });

  it("writes one row per item + a TOTAL row", () => {
    const csv = buildPiutangCSV([item], agg);
    const lines = csv.trim().split("\n");
    expect(lines).toHaveLength(3); // header + 1 item + TOTAL
    expect(lines[2].startsWith("TOTAL")).toBe(true);
  });

  it("sanitizes formula injection (leading = + @ -)", () => {
    const evil: any = { ...item, nama: "=HYPERLINK(\"x\")", nrp: "+123", pangkat: "@root", kesatuan: "-cmd" };
    const csv = buildPiutangCSV([evil], agg);
    // each injected cell must be prefixed with a single quote
    expect(csv).toContain("'=HYPERLINK(\"x\")");
    expect(csv).toContain("'+123");
    expect(csv).toContain("'@root");
    expect(csv).toContain("'-cmd");
  });
});
