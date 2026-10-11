import { describe, it, expect } from "vitest";
import {
    isLoginRateLimited,
    recordLoginFailure,
    clearLoginFailures,
    remainingLockMs,
    loginRateKey,
} from "@/lib/login-rate-limit";

describe("login-rate-limit", () => {
    it("tidak ter-limit di bawah ambang 5 kegagalan", () => {
        const key = "user@example.com|1.2.3.4";
        for (let i = 0; i < 4; i++) recordLoginFailure(key);
        expect(isLoginRateLimited(key)).toBe(false);
        clearLoginFailures(key);
    });

    it("ter-limit tepat pada kegagalan ke-5", () => {
        const key = "a|b";
        for (let i = 0; i < 5; i++) recordLoginFailure(key);
        expect(isLoginRateLimited(key)).toBe(true);
        expect(remainingLockMs(key)).toBeGreaterThan(0);
        clearLoginFailures(key);
        expect(isLoginRateLimited(key)).toBe(false);
    });

    it("window 15 menit: kegagalan lama kedaluwarsa", () => {
        const key = "c|d";
        const t0 = 1_000_000;
        for (let i = 0; i < 5; i++) recordLoginFailure(key, t0 + i * 1000);
        expect(isLoginRateLimited(key, t0 + 60_000)).toBe(true);
        // setelah window lewat semua entri terprune -> bebas
        expect(isLoginRateLimited(key, t0 + 16 * 60_000)).toBe(false);
    });

    it("counter reset saat sukses (clearLoginFailures)", () => {
        const key = "e|f";
        for (let i = 0; i < 5; i++) recordLoginFailure(key);
        clearLoginFailures(key);
        recordLoginFailure(key);
        expect(isLoginRateLimited(key)).toBe(false);
    });

    it("key normalisasi identifier (case/trim) dan IP", () => {
        expect(loginRateKey("  User@X.com ", " 10.0.0.1 ")).toBe("user@x.com|10.0.0.1");
        expect(loginRateKey("", undefined)).toBe("|unknown");
    });

    it("key berbeda tidak saling mempengaruhi (per identifier+IP)", () => {
        const k1 = "g|h";
        const k2 = "g|i";
        for (let i = 0; i < 5; i++) recordLoginFailure(k1);
        expect(isLoginRateLimited(k2)).toBe(false);
        clearLoginFailures(k1);
    });
});
