// scripts/diagnose-mobile-loan-payment-allocation.ts
// Read-only vs prod Neon. Proves the bug: mobile payments (PAY-M-*) historically
// have ZERO PaymentAllocation records (pre-fix). After fix, new mobile payments create them.
// Jalankan: NODE_ENV=production npx tsx --env-file=.env scripts/diagnose-mobile-loan-payment-allocation.ts
import prisma from "../src/lib/prisma";

async function main() {
  const mobilePayments = await prisma.loanPayment.findMany({
    where: { paymentNo: { startsWith: "PAY-M-" } },
    select: {
      id: true,
      paymentNo: true,
      paymentType: true,
      createdAt: true,
      _count: { select: { allocations: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  const total = mobilePayments.length;
  const withAlloc = mobilePayments.filter((p) => p._count.allocations > 0).length;
  const withoutAlloc = total - withAlloc;
  console.log(`=== Mobile loan payments (PAY-M-*) — last ${total} ===`);
  console.log(`with PaymentAllocation   : ${withAlloc}`);
  console.log(
    `WITHOUT PaymentAllocation : ${withoutAlloc}  ${
      withoutAlloc > 0 ? "← pre-fix bug (historical, not retroactive)" : ""
    }`,
  );
  console.log(`\nSample (newest 10):`);
  for (const p of mobilePayments.slice(0, 10)) {
    console.log(
      `  ${p.paymentNo.padEnd(22)} ${(p.paymentType || "?").padEnd(16)} allocs=${p._count.allocations}  ${p.createdAt.toISOString().slice(0, 10)}`,
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
