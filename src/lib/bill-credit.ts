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
      p.note === `Applied to Bill ${bill.invoiceNo}` ||
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

export function paymentTotalsByMethod(payments: PaymentCreditFields[]) {
  const totals: Record<string, number> = {};
  for (const p of payments) {
    totals[p.method] = (totals[p.method] || 0) + p.amount;
  }
  return totals;
}
