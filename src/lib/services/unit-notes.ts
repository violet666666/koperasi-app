// Tag notes UnitTransaction — konvensi [PLAT:] sudah ada (4 parser di repo);
// ini menambah [HP:] utk no. phone pelanggan (digits-only, prefix-matchable)
// dan [NAMA:] utk nama pelanggan walk-in. Pure module — no prisma import.
// Unit-tested di __tests__/unit-notes.test.ts

export type NoteTag = "PLAT" | "HP" | "NAMA";

export function normalizePhone(raw: unknown): string {
    return String(raw ?? "").replace(/\D/g, "");
}

export interface UnitCustomerTags {
    plate?: string | null;
    phone?: string | null;
    customerName?: string | null;
}

/** Gabung tag jadi satu string notes; null jika semua kosong. Plat di-uppercase, phone dinormalisasi. */
export function buildUnitNotes({ plate, phone, customerName }: UnitCustomerTags): string | null {
    const tags: string[] = [];
    const p = String(plate ?? "").trim().toUpperCase();
    const digits = normalizePhone(phone);
    const name = String(customerName ?? "").trim().replace(/[[\]]/g, ""); // bracket merusak format tag
    if (p) tags.push(`[PLAT:${p}]`);
    if (digits.length >= 8) tags.push(`[HP:${digits}]`); // < 8 digit = bukan no. HP valid, jangan simpan
    if (name) tags.push(`[NAMA:${name}]`);
    return tags.length ? tags.join(" ") : null;
}

export function extractNoteTag(notes: string | null | undefined, tag: NoteTag): string | null {
    const m = notes?.match(new RegExp(`\\[${tag}:([^\\]]*)\\]`));
    return m?.[1]?.trim() || null;
}
