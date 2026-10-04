"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Tag } from "./ui/Tag";
import { inr } from "@/lib/constants";
import {
  initialBillCredit,
  paymentTotalsByMethod,
  remainingBillCredit,
  type PaymentCreditFields,
} from "@/lib/bill-credit";
import { settleBillCredit } from "@/lib/actions";
import { useToast } from "./ui/Toast";

export type BillForCredit = {
  id: number;
  invoiceNo: string;
  date: string;
  balance: number;
  status?: string | null;
};

export function BillPaymentBreakdown({ payments }: { payments: PaymentCreditFields[] }) {
  const totals = paymentTotalsByMethod(payments);
  if (payments.length === 0) {
    return <div className="text-sm themed-muted">No payments recorded on this bill yet.</div>;
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2 mb-2">
        {Object.entries(totals).map(([method, amount]) => (
          <Tag key={method} tone={method === "Cash" ? "green" : method === "Claim" ? "amber" : "teal"}>
            {method} {inr(amount)}
          </Tag>
        ))}
      </div>
      <table className="soft-table">
        <thead>
          <tr>
            {["Date", "Amount", "Mode", "Note"].map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td className="themed-muted">{p.date}</td>
              <td className="font-semibold themed-title">{inr(p.amount)}</td>
              <td>
                <Tag tone={p.method === "Cash" ? "green" : p.method === "Claim" ? "amber" : "teal"}>
                  {p.method}
                </Tag>
              </td>
              <td className="themed-muted">{p.note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillCreditPayForm({
  bill,
  remaining,
}: {
  bill: BillForCredit;
  remaining: number;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();
  const amountN = Number(amount) || 0;
  const canPay = remaining > 0 && amountN > 0 && amountN <= remaining && !pending && bill.status !== "voided";

  function submit() {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast("Enter a valid payment amount.", "error");
      return;
    }
    if (n > remaining) {
      toast(`Payment cannot exceed this bill's remaining credit of ${inr(remaining)}.`, "error");
      return;
    }
    startTransition(async () => {
      try {
        await settleBillCredit(bill.id, n, method);
        toast(`${inr(n)} collected against ${bill.invoiceNo}`);
        setAmount("");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not record payment.", "error");
      }
    });
  }

  if (bill.status === "voided" || remaining <= 0) return null;

  return (
    <div className="flex gap-2 items-center mb-3 flex-wrap">
      <input
        className="field w-[140px]"
        type="number"
        min={0}
        max={remaining}
        placeholder="Amount received"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        disabled={pending}
      />
      <select className="field w-[110px]" value={method} onChange={(e) => setMethod(e.target.value)} disabled={pending}>
        <option>Cash</option>
        <option>Online</option>
      </select>
      <button className="btn btn-primary" onClick={submit} disabled={!canPay}>
        Pay this bill
      </button>
      <button className="btn text-xs" type="button" disabled={pending} onClick={() => setAmount(String(remaining))}>
        Pay full {inr(remaining)}
      </button>
    </div>
  );
}

export function billCreditLabel(bill: BillForCredit, payments: PaymentCreditFields[]) {
  const initial = initialBillCredit(bill);
  const remaining = remainingBillCredit(bill, payments);
  return { initial, remaining };
}
