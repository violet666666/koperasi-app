// Reproduces POST /api/billing/[periodId]/process transaction body for period 15.
// Any throw rolls the whole transaction back — no writes persist.
import { PrismaClient, Prisma } from "@prisma/client";
import { extractSaleNo } from "../src/lib/services/billing";

const prisma = new PrismaClient();
const USER_ID = 727; // operator@koperasi.com — real users.id

async function main() {
  const period = await prisma.billingPeriod.findUnique({
    where: { id: 15 },
    include: { billingItems: true },
  });
  if (!period) throw new Error("period 15 not found");
  console.log(`Period 15: ${period.billingItems.length} items, status=${period.status}`);

  const itemsToSettle = period.billingItems;
  const userId = USER_ID;
  const settledAt = new Date().toISOString();

  try {
    await prisma.$transaction(async (tx) => {
      await tx.billingItem.updateMany({
        where: { billingPeriodId: period.id },
        data: { isMarkedPaid: true, paidAt: new Date(), paidById: userId },
      });

      for (const item of itemsToSettle) {
        if (item.transactionSource === "unit_transaction" && item.transactionId) {
          await tx.unitTransaction.update({
            where: { id: item.transactionId },
            data: { isPaid: true, paidDate: new Date() },
          });
          const saleNo = extractSaleNo(item.description);
          if (saleNo) {
            const linkedSale = await tx.storeSale.findUnique({
              where: { saleNo },
              select: { id: true, metadata: true },
            });
            if (linkedSale) {
              const meta = (typeof linkedSale.metadata === "string"
                ? JSON.parse(linkedSale.metadata)
                : linkedSale.metadata ?? {}) as Record<string, unknown>;
              if (!meta.isSettled) {
                await tx.storeSale.update({
                  where: { id: linkedSale.id },
                  data: { metadata: { ...meta, isSettled: true, settledAt } },
                });
              }
            }
          }
        }
      }

      console.log("item loop done — rolling back intentionally");
      throw new Error("INTENTIONAL_ROLLBACK");
    }, { timeout: 120_000, maxWait: 30_000 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      console.error("\n>>> ROOT CAUSE: PrismaClientKnownRequestError");
      console.error("    code:", e.code);
      console.error("    message:", e.message);
      console.error("    meta:", JSON.stringify(e.meta, null, 2));
    } else if ((e as Error).message === "INTENTIONAL_ROLLBACK") {
      console.log("\n>>> item-loop stage PASSED cleanly (rolled back on purpose)");
    } else {
      console.error("\n>>> OTHER ERROR:", e);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
