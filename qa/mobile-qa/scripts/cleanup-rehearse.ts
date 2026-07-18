// Dry-run (default) or --apply cleanup of QA test artifacts by marker.
// Usage: npx tsx qa/mobile-qa/scripts/cleanup-rehearse.ts --manifest <path> [--apply --confirm-yes]
// SAFETY: --apply requires both --manifest AND --confirm-yes. Dry-run = count-only, 0 DB writes.
// Pattern: scripts/cleanup-hu-test-residue.ts (dry-run/apply, guards, CSV backup).
// This rehearsal script is COUNT-ONLY in dry-run mode to verify candidate rows before the live gate.
// Actual cleanup at the live gate uses the in-app void/reversal APIs, NOT raw DB deletes for ledger artifacts.
import { PrismaClient } from "@prisma/client";
import path from "path";
import { readFileSync } from "fs";

const prisma = new PrismaClient();

function usage() {
  console.error("Usage: npx tsx qa/mobile-qa/scripts/cleanup-rehearse.ts --manifest <path> [--apply --confirm-yes]");
  process.exit(2);
}

async function main() {
  const manifestIdx = process.argv.indexOf("--manifest");
  if (manifestIdx < 0) usage();
  const manifestPath = process.argv[manifestIdx + 1];
  if (!manifestPath) usage();

  const apply = process.argv.includes("--apply");
  const confirmYes = process.argv.includes("--confirm-yes");

  console.log(`[cleanup] mode=${apply ? "APPLY" : "DRY-RUN"} manifest=${manifestPath}`);

  if (apply && !confirmYes) {
    console.error("[cleanup] BLOCKED — --apply requires --confirm-yes for safety");
    process.exit(2);
  }

  const manifest = JSON.parse(readFileSync(path.resolve(manifestPath), "utf8"));
  console.log(`[cleanup] sessionId=${manifest.sessionId} mutations=${manifest.mutations.length}`);

  for (const m of manifest.mutations) {
    console.log(`  marker=${m.marker} route=${m.route} expectedCleanup=${m.expectedCleanup}`);

    if (!apply) {
      // DRY-RUN: count candidate rows matching the QA marker in description-like fields.
      // We count but do NOT delete. The live gate uses void/reversal APIs per artifact type.
      const cbCount = await prisma.cashBankTransaction.count({
        where: { description: { contains: m.marker } },
      });
      console.log(`    CB rows matching: ${cbCount}`);
    }
    // APPLY mode (not used in this plan — live gate is interactive void/reversal only).
    // Implementer: NEVER add raw Prisma deleteMany here; follow the void/reversal pattern
    // documented in each mutation's expectedCleanup field.
  }

  console.log("[cleanup] rehearsal complete — no writes performed");
}

main()
  .finally(() => prisma.$disconnect())
  .catch((e) => {
    console.error("[cleanup] FAILED:", e);
    process.exit(1);
  });