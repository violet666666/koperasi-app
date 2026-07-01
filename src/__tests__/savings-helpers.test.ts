import { describe, it, expect } from "vitest";
import { isWithdrawalBlocked } from "@/lib/savings-helpers";

describe("isWithdrawalBlocked (AD-ART Pasal 26)", () => {
  it("blocks withdrawal of non-withdrawable product while member active (Pokok/Wajib)", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "active" })).toBe(true);
  });

  it("allows withdrawal of Sukarela (canWithdraw=true) even when active", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: true, memberStatus: "active" })).toBe(false);
  });

  it("allows withdrawal of non-withdrawable product when member NOT active (pensiun/resigned)", () => {
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "pensiun" })).toBe(false);
    expect(isWithdrawalBlocked({ type: "withdrawal", canWithdraw: false, memberStatus: "resigned" })).toBe(false);
  });

  it("never blocks deposits", () => {
    expect(isWithdrawalBlocked({ type: "deposit", canWithdraw: false, memberStatus: "active" })).toBe(false);
  });
});
