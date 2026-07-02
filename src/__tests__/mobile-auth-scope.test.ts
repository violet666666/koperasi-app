import { describe, it, expect } from "vitest";
import { canAccessBranch, canAccessUnit } from "@/lib/mobile-auth-scope";

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
