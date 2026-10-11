/**
 * Login rate limiter (brute-force protection) untuk web (NextAuth) dan mobile
 * (JWT login). Key = identifier|ip.
 *
 * ponytail: in-memory per-instance — cukup untuk deploy Railway single-instance
 * saat ini. Upgrade path: pindah ke Redis/DB (dengan TTL) saat scale-out >1
 * instance, interface fungsi tidak berubah.
 */

const MAX_FAILURES = 5;
const WINDOW_MS = 15 * 60 * 1000;

type FailureEntry = { count: number; firstAt: number };
const failures = new Map<string, FailureEntry>();

function pruneExpired(now: number): void {
    for (const [key, entry] of failures) {
        if (now - entry.firstAt >= WINDOW_MS) failures.delete(key);
    }
}

export function isLoginRateLimited(key: string, now: number = Date.now()): boolean {
    pruneExpired(now);
    const entry = failures.get(key);
    return !!entry && entry.count >= MAX_FAILURES;
}

export function recordLoginFailure(key: string, now: number = Date.now()): void {
    const entry = failures.get(key);
    if (!entry || now - entry.firstAt >= WINDOW_MS) {
        failures.set(key, { count: 1, firstAt: now });
        return;
    }
    entry.count += 1;
}

export function clearLoginFailures(key: string): void {
    failures.delete(key);
}

export function remainingLockMs(key: string, now: number = Date.now()): number {
    const entry = failures.get(key);
    if (!entry || entry.count < MAX_FAILURES) return 0;
    return Math.max(0, WINDOW_MS - (now - entry.firstAt));
}

/** Key stabil: identifier lowercase + IP (fallback "unknown"). */
export function loginRateKey(identifier: string, ip: string | null | undefined): string {
    return `${(identifier || "").trim().toLowerCase()}|${(ip || "unknown").trim()}`;
}
