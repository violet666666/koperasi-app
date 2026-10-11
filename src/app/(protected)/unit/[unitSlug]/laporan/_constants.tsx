"use client";

import * as React from "react";
import { Car, Scissors, Gamepad2, Dumbbell, Shirt, Store, UtensilsCrossed } from "lucide-react";

// ── Unit label map ──────────────────────────────────────────────────────────
export const UNIT_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
    cuci_mobil: { label: "Cuci Mobil & Motor", icon: Car },
    barbershop: { label: "Barbershop", icon: Scissors },
    playstation: { label: "Play Station", icon: Gamepad2 },
    fitness: { label: "Fitness", icon: Dumbbell },
    laundry: { label: "Laundry", icon: Shirt },
    toko: { label: "Toko PRIMKOPPOL", icon: Store },
    coffe_latar: { label: "Coffe Latar", icon: UtensilsCrossed },
    resto: { label: "Resto & Cafe", icon: UtensilsCrossed },
};

export const PERIODS = [
    { value: "today", label: "Hari Ini" },
    { value: "week", label: "Minggu Ini" },
    { value: "month", label: "Bulan Ini" },
    { value: "year", label: "Tahun Ini" },
    { value: "custom", label: "Kustom..." },
];

export const METHOD_LABEL: Record<string, string> = {
    cash: "Tunai",
    qris: "QRIS",
    salary_cut: "Potong Gaji",
    lainnya: "Lainnya",
};

export const OPS_PAYMENT_METHODS = [
    { value: "cash", label: "Tunai" },
    { value: "qris", label: "QRIS" },
    { value: "lainnya", label: "Lainnya" },
] as const;

// Jenis pengeluaran → kategori CB. Sinkron OPS_EXPENSE_CATEGORIES (constants/units).
// operational masuk beban laba; hpp_toko diakui via HPP penjualan; belanja_aset = capex.
export const OPS_EXPENSE_CATEGORY_OPTIONS = [
    { value: "operational", label: "Operasional (Beban Unit)" },
    { value: "hpp_toko", label: "Belanja Barang / Bahan Dagangan" },
    { value: "belanja_aset", label: "Belanja Aset / Peralatan" },
] as const;

export const EXPENSE_CATEGORY_BADGE: Record<string, string> = {
    hpp_toko: "Barang Dagangan",
    belanja_aset: "Aset / Capex",
};


export function formatUnitName(slug: string) {
    return slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
