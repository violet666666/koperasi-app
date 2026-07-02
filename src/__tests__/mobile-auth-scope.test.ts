import { describe, it, expect } from "vitest";
import { canAccessBranch, canAccessUnit, branchListFilter, unitListFilter } from "@/lib/mobile-auth-scope";

describe("canAccessBranch", () => {
  it("operator bypasses any branch", () => {
    expect(canAccessBranch({ role: "operator", branchId: null, unitType: null }, 1).allowed).toBe(true);
    expect(canAccessBranch({ role: "operator", branchId: 5, unitType: "toko" }, 999).allowed).toBe(true);
  });
  it("non-operator with matching branch is allowed", () => {
    expect(canAccessBranch({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" }, 1).allowed).toBe(true);
  });
  it("non-operator with mismatched branch is denied with a reason", () => {
    const d = canAccessBranch({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" }, 2);
    expect(d.allowed).toBe(false);
    expect(d.reason).toBeTruthy();
  });
  it("non-operator with null branchId is denied (fail-closed)", () => {
    expect(canAccessBranch({ role: "admin", branchId: null, unitType: "toko" }, 1).allowed).toBe(false);
  });
});

describe("canAccessUnit", () => {
  it("operator bypasses", () => {
    expect(canAccessUnit({ role: "operator", branchId: null, unitType: null }, "toko").allowed).toBe(true);
  });
  it("non-operator matching unit exactly is allowed", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "toko" }, "toko").allowed).toBe(true);
  });
  it("non-operator matching via alias family is allowed", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "resto_cafe" }, "resto").allowed).toBe(true);
    expect(canAccessUnit({ role: "admin", branchId: 1, unitType: "resto" }, "coffe_latar").allowed).toBe(true);
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "playstation" }, "play_station").allowed).toBe(true);
  });
  it("non-operator mismatched unit is denied", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: "toko" }, "resto").allowed).toBe(false);
  });
  it("non-operator with null unitType is denied (fail-closed)", () => {
    expect(canAccessUnit({ role: "kasir", branchId: 1, unitType: null }, "toko").allowed).toBe(false);
  });
});

describe("branchListFilter", () => {
  it("operator gets empty filter (no restriction)", () => {
    expect(branchListFilter({ role: "operator", branchId: null, unitType: null })).toEqual({ ok: true, filter: {} });
  });
  it("non-operator with branchId gets branch filter", () => {
    expect(branchListFilter({ role: "admin_sp", branchId: 1, unitType: "simpan_pinjam" })).toEqual({ ok: true, filter: { branchId: 1 } });
  });
  it("non-operator with null branchId is fail-closed", () => {
    expect(branchListFilter({ role: "admin", branchId: null, unitType: "toko" })).toEqual({ ok: false });
  });
});

describe("unitListFilter", () => {
  it("operator gets empty filter", () => {
    expect(unitListFilter({ role: "operator", branchId: null, unitType: null })).toEqual({ ok: true, filter: {} });
  });
  it("non-operator toko gets {unitType:{in:[toko]}}", () => {
    expect(unitListFilter({ role: "kasir", branchId: 1, unitType: "toko" })).toEqual({ ok: true, filter: { unitType: { in: ["toko"] } } });
  });
  it("non-operator resto_cafe gets the resto alias family", () => {
    const r = unitListFilter({ role: "kasir", branchId: 1, unitType: "resto_cafe" });
    expect(r.ok).toBe(true);
    if (r.ok) expect((r.filter as any).unitType.in).toEqual(expect.arrayContaining(["resto", "resto_cafe", "coffe_latar"]));
  });
  it("non-operator cuci_mobil (no alias family) gets singleton", () => {
    const r = unitListFilter({ role: "admin", branchId: 1, unitType: "cuci_mobil" });
    expect(r).toEqual({ ok: true, filter: { unitType: { in: ["cuci_mobil"] } } });
  });
  it("non-operator with null unitType is fail-closed", () => {
    expect(unitListFilter({ role: "kasir", branchId: 1, unitType: null })).toEqual({ ok: false });
  });
});
