/**
 * Pure helpers for the Haji & Umrah test-residue cleanup.
 * Spec: docs/superpowers/specs/2026-06-25-hu-test-residue-cleanup-design.md
 *
 * Framework-free + side-effect-free so they are unit-testable. The CLI script
 * (scripts/cleanup-hu-test-residue.ts) owns all DB I/O and calls these.
 */

/** User ids whose deposits on an H&U account are treated as test residue. */
export const ALLOWED_TEST_CREATOR_IDS = [727, 1612]; // operator, adminhajiumrah

const TEST_NOTES_PATTERNS = ["e2e", "test setoran", "playwright"];
const GENERIC_TEST_NOTE = "Setoran Tabungan Haji";

export type SavingsTxnRow = {
  id: number;
  transactionNo: string;
  notes: string | null;
  createdById: number;
};

export type CashBankRow = {
  id: number;
  transactionNo: string;
  type: string; // "in" | "out"
  amount: number;
  accountId: number;
};

export type BalanceDelta = { inSum: number; outSum: number; net: number };

/**
 * Whether a savings transaction looks like test residue. Used ONLY by the
 * "mixed account" guard — actual deletion removes the whole test account.
 * A generic-note deposit counts as test only if its creator is a known test
 * account; a deposit by any other (real) teller returns false so the guard
 * aborts rather than risk deleting real member activity.
 */
export function isTestSavingsTxn(txn: SavingsTxnRow): boolean {
  const notes = (txn.notes || "").toLowerCase();
  if (TEST_NOTES_PATTERNS.some((p) => notes.includes(p))) return true;
  if ((txn.transactionNo || "").startsWith("BH-")) return true; // bagi-hasil interest credit
  if (txn.notes === GENERIC_TEST_NOTE && ALLOWED_TEST_CREATOR_IDS.includes(txn.createdById)) return true;
  return false;
}

/**
 * Per-CashBankAccount net balance impact of a set of CB rows.
 *  - net > 0: rows inflated the account → deleting them must DECREMENT by net.
 *  - net < 0: rows deflated the account → deleting them must INCREMENT by |net|.
 *  - net = 0: voided in/out pair → no balance change.
 */
export function computeBalanceDeltas(rows: CashBankRow[]): Map<number, BalanceDelta> {
  const map = new Map<number, BalanceDelta>();
  for (const r of rows) {
    const d = map.get(r.accountId) ?? { inSum: 0, outSum: 0, net: 0 };
    const amt = Number(r.amount) || 0;
    if (r.type === "in") {
      d.inSum += amt;
      d.net += amt;
    } else if (r.type === "out") {
      d.outSum += amt;
      d.net -= amt;
    }
    map.set(r.accountId, d);
  }
  return map;
}

export const DEFAULT_CB_BAND = { min: 30, max: 60 };

export type GuardViolation =
  | { type: "mixed_account"; accountId: number; nonTestTxnIds: number[] }
  | { type: "live_bagi_hasil"; distributionIds: number[] }
  | { type: "live_talangan_loan"; loanIds: number[] }
  | { type: "test_product_has_refs"; products: { id: number; accounts: number; txns: number }[] }
  | { type: "cb_count_out_of_band"; count: number; min: number; max: number };

export type GuardInput = {
  huAccounts: { id: number; txns: SavingsTxnRow[] }[];
  bagiDistStatuses: { id: number; status: string }[];
  talanganLoanStatuses: { id: number; status: string }[];
  testProductRefs: { id: number; accounts: number; txns: number }[];
  cbCount: number;
  cbMin?: number;
  cbMax?: number;
};

/** Returns guard violations. The cleanup script aborts (no writes) if non-empty. */
export function evaluateGuards(input: GuardInput): GuardViolation[] {
  const v: GuardViolation[] = [];

  for (const acct of input.huAccounts) {
    const nonTest = acct.txns.filter((t) => !isTestSavingsTxn(t)).map((t) => t.id);
    if (nonTest.length > 0) v.push({ type: "mixed_account", accountId: acct.id, nonTestTxnIds: nonTest });
  }

  const liveBagi = input.bagiDistStatuses.filter((d) => d.status !== "voided").map((d) => d.id);
  if (liveBagi.length > 0) v.push({ type: "live_bagi_hasil", distributionIds: liveBagi });

  const liveLoans = input.talanganLoanStatuses.filter((l) => l.status !== "voided").map((l) => l.id);
  if (liveLoans.length > 0) v.push({ type: "live_talangan_loan", loanIds: liveLoans });

  const refdProducts = input.testProductRefs.filter((p) => p.accounts > 0 || p.txns > 0);
  if (refdProducts.length > 0) v.push({ type: "test_product_has_refs", products: refdProducts });

  const min = input.cbMin ?? DEFAULT_CB_BAND.min;
  const max = input.cbMax ?? DEFAULT_CB_BAND.max;
  if (input.cbCount < min || input.cbCount > max) {
    v.push({ type: "cb_count_out_of_band", count: input.cbCount, min, max });
  }

  return v;
}
