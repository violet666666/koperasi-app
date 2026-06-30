export type IncomeJenis = "operasional" | "customer";

export interface IncomeMode {
  createsUnitTransaction: boolean;
  cbCategory: "operational" | "pendapatan_unit";
  memberId: number | null;
}

/**
 * Tentukan mode penulisan income berdasar jenis input form "Catat Pemasukan".
 * - "customer": create UnitTransaction (+ CB pendapatan_unit mirror) → flow ke riwayat + SHU per-unit + jasa anggota.
 * - "operasional" (default): CB operational saja (sewa/dll).
 */
export function resolveIncomeMode(
  jenis: string | null | undefined,
  memberId: number | string | null | undefined,
): IncomeMode {
  if (jenis === "customer") {
    const n = Number(memberId);
    return {
      createsUnitTransaction: true,
      cbCategory: "pendapatan_unit",
      memberId: memberId !== null && memberId !== undefined && !Number.isNaN(n) ? n : null,
    };
  }
  return { createsUnitTransaction: false, cbCategory: "operational", memberId: null };
}
