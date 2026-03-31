/**
 * Konversi angka menjadi teks terbilang dalam Bahasa Indonesia.
 * Contoh: 9800000 => "Sembilan Juta Delapan Ratus Ribu Rupiah"
 */

const units = ["", "Satu", "Dua", "Tiga", "Empat", "Lima", "Enam", "Tujuh", "Delapan", "Sembilan"];
const teens = [
    "Sepuluh", "Sebelas", "Dua Belas", "Tiga Belas", "Empat Belas",
    "Lima Belas", "Enam Belas", "Tujuh Belas", "Delapan Belas", "Sembilan Belas",
];

function convert(n: number): string {
    if (n === 0) return "";
    if (n < 10) return units[n];
    if (n < 20) return teens[n - 10];
    if (n < 100) return units[Math.floor(n / 10)] + " Puluh" + (n % 10 ? " " + units[n % 10] : "");
    if (n < 200) return "Seratus" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 1000) return units[Math.floor(n / 100)] + " Ratus" + (n % 100 ? " " + convert(n % 100) : "");
    if (n < 2000) return "Seribu" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 1_000_000) return convert(Math.floor(n / 1000)) + " Ribu" + (n % 1000 ? " " + convert(n % 1000) : "");
    if (n < 1_000_000_000) return convert(Math.floor(n / 1_000_000)) + " Juta" + (n % 1_000_000 ? " " + convert(n % 1_000_000) : "");
    if (n < 1_000_000_000_000) return convert(Math.floor(n / 1_000_000_000)) + " Miliar" + (n % 1_000_000_000 ? " " + convert(n % 1_000_000_000) : "");
    return convert(Math.floor(n / 1_000_000_000_000)) + " Triliun" + (n % 1_000_000_000_000 ? " " + convert(n % 1_000_000_000_000) : "");
}

export function terbilang(amount: number): string {
    if (amount === 0) return "Nol Rupiah";
    const result = convert(Math.floor(Math.abs(amount)));
    return result + " Rupiah";
}

/**
 * Daftar semua metode pembayaran yang diakui di sistem kwitansi Koperasi.
 */
export const PAYMENT_METHODS = [
    { value: "cash", label: "Tunai" },
    { value: "bank_transfer", label: "Transfer Bank" },
    { value: "potong_gaji", label: "Potong Gaji" },
    { value: "debet_simpanan", label: "Debet Simpanan" },
    { value: "qris", label: "QRIS / E-Wallet" },
] as const;

export type PaymentMethodValue = typeof PAYMENT_METHODS[number]["value"];

/**
 * Mendapatkan label metode pembayaran berdasarkan value.
 */
export function getPaymentMethodLabel(value: string): string {
    const found = PAYMENT_METHODS.find((m) => m.value === value);
    return found?.label || value;
}
