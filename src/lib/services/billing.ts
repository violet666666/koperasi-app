export interface BillingPeriodCalc {
  periodStart: Date;
  periodEnd: Date;
  periodLabel: string;
}

export interface BillingItemData {
  id: number;
  memberId: number;
  amount: number;
  isMarkedPaid: boolean;
}

export interface MemberBillingSummary {
  memberId: number;
  memberName: string;
  totalAmount: number;
  markedPaidAmount: number;
  items: BillingItemData[];
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export function calculateBillingPeriod(referenceDate: Date): BillingPeriodCalc {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();

  let startMonth: number;
  let startYear: number;

  if (referenceDate.getDate() >= 16) {
    startMonth = month;
    startYear = year;
  } else {
    startMonth = month - 1;
    startYear = year;
    if (startMonth < 0) {
      startMonth = 11;
      startYear--;
    }
  }

  const periodStart = new Date(startYear, startMonth, 16);

  let endMonth = startMonth + 1;
  let endYear = startYear;
  if (endMonth > 11) {
    endMonth = 0;
    endYear++;
  }
  const periodEnd = new Date(endYear, endMonth, 15);

  const periodLabel = `${MONTHS[startMonth]}-${MONTHS[endMonth]} ${endYear}`;

  return { periodStart, periodEnd, periodLabel };
}

export function computeMemberSummary(
  memberName: string,
  items: BillingItemData[]
): MemberBillingSummary {
  return {
    memberId: items[0]?.memberId ?? 0,
    memberName,
    totalAmount: items.reduce((sum, i) => sum + i.amount, 0),
    markedPaidAmount: items.filter((i) => i.isMarkedPaid).reduce((sum, i) => sum + i.amount, 0),
    items,
  };
}

export function toggleMemberItems(
  items: BillingItemData[],
  markedPaid: boolean
): BillingItemData[] {
  return items.map((item) => ({ ...item, isMarkedPaid: markedPaid }));
}
