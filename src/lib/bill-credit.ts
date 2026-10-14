export type BillCreditFields = {
  id: number;
  invoiceNo: string;
  balance: number;
  status?: string | null;
};

export type PaymentCreditFields = {
  id: number;
  billId?: number | null;
  amount: number;
  method: string;
  note: string | null;
  date: string;
};

export function billCreditNote(invoiceNo: string) {
  return `Bill credit ${invoiceNo}`;
}

export function isBillCreditSettlement(note: string | null | undefined) {
  const n = note || "";
  return n === "Credit settlement" || n.startsWith("Bill credit ");
}

export function initialBillCredit(bill: Pick<BillCreditFields, "balance">) {
  return Math.max(0, bill.balance);
}

export function paymentsForBill(bill: BillCreditFields, payments: PaymentCreditFields[]) {
  return payments.filter(
    (p) =>
      p.billId === bill.id ||
      p.note === `Bill ${bill.invoiceNo}` ||
      (p.note || "").startsWith(`Applied to Bill ${bill.invoiceNo}`) ||
      p.note === billCreditNote(bill.invoiceNo)
  );
}

export function settledAgainstBill(bill: BillCreditFields, payments: PaymentCreditFields[]) {
  return paymentsForBill(bill, payments)
    .filter((p) => isBillCreditSettlement(p.note))
    .reduce((sum, p) => sum + p.amount, 0);
}

export function remainingBillCredit(bill: BillCreditFields, payments: PaymentCreditFields[]) {
  if (bill.status === "voided") return 0;
  return Math.max(0, initialBillCredit(bill) - settledAgainstBill(bill, payments));
}

export function remainingCreditForCustomer(
  customerId: number,
  bills: (BillCreditFields & { customerId: number })[],
  payments: PaymentCreditFields[]
) {
  return bills
    .filter((b) => b.customerId === customerId)
    .reduce((sum, b) => sum + remainingBillCredit(b, payments), 0);
}

/** Positive debt follows open bills. Negative balance is leftover advance. */
export function displayedCustomerCredit(creditBalance: number, remainingOnBills: number) {
  if (remainingOnBills > 0) return remainingOnBills;
  if (creditBalance < 0) return creditBalance;
  return 0;
}

export function availableAdvance(creditBalance: number) {
  return creditBalance < 0 ? -creditBalance : 0;
}

/** How much claim can come off this customer: outstanding credit or advance. */
export function availableClaim(creditBalance: number) {
  return Math.abs(creditBalance);
}

/**
 * Unpaid balance is new credit.
 * Claim against outstanding credit reduces what they owe.
 * Claim against advance consumes the overpayment.
 */
export function creditChangeFromBill(balance: number, claim: number, creditBalance: number) {
  const applied = Math.max(0, Math.min(claim, availableClaim(creditBalance)));
  if (creditBalance > 0) return balance - applied;
  if (creditBalance < 0) return balance + applied;
  return balance;
}

export function paymentTotalsByMethod(payments: PaymentCreditFields[]) {
  const totals: Record<string, number> = {};
  for (const p of payments) {
    totals[p.method] = (totals[p.method] || 0) + p.amount;
  }
  return totals;
}
