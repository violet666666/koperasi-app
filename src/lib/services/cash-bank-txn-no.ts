// Pure crypto-based txn-number generator for mobile Kas/Bank (web keeps its own Math.random version).
import { randomBytes } from "crypto";

const crypto6 = (): string => String(randomBytes(4).readUInt32BE(0) % 1_000_000).padStart(6, "0");

export function generateCashBankTxnNo(type: "in" | "out", year: number): string {
  const prefix = type === "in" ? "CBM" : "CBK"; // CBM = masuk (debit), CBK = keluar (kredit)
  return `${prefix}-${year}-${crypto6()}`;
}

export function generateTransferTxnNo(year: number): string {
  return `TRF-${year}-${crypto6()}`;
}
