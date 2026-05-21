/**
 * Calculate plafon piutang for a member.
 * Priority: manual plafonPiutang > auto-calculate from sisaGaji.
 * Strict mode: if sisaGaji is null/0, returns 0 (cannot borrow).
 */
export function getPlafonPiutang(member: {
    plafonPiutang: number | { toNumber(): number };
    sisaGaji: number | null | { toNumber(): number };
}): number {
    const plafon = typeof member.plafonPiutang === "number"
        ? member.plafonPiutang
        : member.plafonPiutang.toNumber();

    if (plafon > 0) return plafon;

    const sisa = member.sisaGaji == null
        ? 0
        : typeof member.sisaGaji === "number"
            ? member.sisaGaji
            : member.sisaGaji.toNumber();

    if (sisa <= 0) return 0;

    return Math.floor(sisa * 0.5);
}
