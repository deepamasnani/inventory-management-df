"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Pencil } from "lucide-react";
import { Card } from "./ui/Card";
import { Tag } from "./ui/Tag";
import { customerSearchHaystack, formatCustomerLabel, inr } from "@/lib/constants";
import { renameCustomer } from "@/lib/actions";
import {
  displayedCustomerCredit,
  initialBillCredit,
  paymentsForBill,
  remainingBillCredit,
  remainingCreditForCustomer,
  type PaymentCreditFields,
} from "@/lib/bill-credit";
import { BillCreditPayForm, BillPaymentBreakdown } from "./BillPaymentDetails";
import { useToast } from "./ui/Toast";

type Customer = { id: number; name: string; type: string; creditBalance: number };
type Bill = {
  id: number;
  invoiceNo: string;
  date: string;
  customerId: number;
  balance: number;
  status?: string | null;
};

function CustomerBills({
  customer,
  bills,
  payments,
  onOpenBill,
}: {
  customer: Customer;
  bills: Bill[];
  payments: PaymentCreditFields[];
  onOpenBill: (billId: number) => void;
}) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const outstanding = remainingCreditForCustomer(customer.id, bills, payments);

  if (bills.length === 0) {
    return <div className="p-3 text-sm themed-muted">No bills for this customer yet.</div>;
  }

  return (
    <div className="p-3">
      <div className="text-xs themed-muted mb-2">
        {outstanding > 0 ? (
          <>
            Total outstanding: <b className="font-mono text-[#E07A3A]">{inr(outstanding)}</b>
            {" · "}Pay against a specific bill below.
          </>
        ) : (
          <>No outstanding credit. Expand a bill to see how it was paid.</>
        )}
      </div>
      <table className="soft-table">
        <thead>
          <tr>
            {["Bill", "Date", "Initial credit", "Remaining", ""].map((h) => (
              <th key={h || "actions"}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bills.map((bill) => {
            const initial = initialBillCredit(bill);
            const remaining = remainingBillCredit(bill, payments);
            const billPayments = paymentsForBill(bill, payments);
            const open = expandedId === bill.id;
            return (
              <React.Fragment key={bill.id}>
                <tr>
                  <td className="font-semibold themed-title">
                    <button
                      type="button"
                      className="underline underline-offset-2 hover:opacity-80"
                      onClick={() => onOpenBill(bill.id)}
                    >
                      {bill.invoiceNo}
                    </button>
                    {bill.status === "voided" ? (
                      <span className="ml-2"><Tag tone="amber">Voided</Tag></span>
                    ) : null}
                  </td>
                  <td className="themed-muted">{bill.date}</td>
                  <td className="themed-muted">{initial > 0 ? inr(initial) : "—"}</td>
                  <td className={`font-semibold ${remaining > 0 ? "text-[#E07A3A]" : "themed-muted"}`}>
                    {remaining > 0 ? inr(remaining) : "—"}
                  </td>
                  <td>
                    <button className="btn text-xs" onClick={() => setExpandedId(open ? null : bill.id)}>
                      {open ? <ChevronDown size={13} className="inline" /> : <ChevronRight size={13} className="inline" />}{" "}
                      {open ? "Hide payments" : "Payments"}
                    </button>
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} style={{ background: "var(--surface)" }}>
                      <div className="p-3">
                        <BillCreditPayForm bill={bill} remaining={remaining} />
                        <BillPaymentBreakdown payments={billPayments} />
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function CustomersTab({
  customers,
  bills,
  payments,
  onOpenBill,
  initialQuery = "",
  initialOpenId = null,
}: {
  customers: Customer[];
  bills: Bill[];
  payments: PaymentCreditFields[];
  onOpenBill: (billId: number) => void;
  initialQuery?: string;
  initialOpenId?: number | null;
}) {
  const [openId, setOpenId] = useState<number | null>(initialOpenId);
  const [query, setQuery] = useState(initialQuery);
  const [renameTarget, setRenameTarget] = useState<Customer | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialOpenId) setOpenId(initialOpenId);
  }, [initialOpenId]);

  const q = query.toLowerCase().trim();
  const filtered = customers.filter((c) => customerSearchHaystack(c).includes(q));

  function saveRename() {
    if (!renameTarget) return;
    const target = renameTarget;
    startTransition(async () => {
      try {
        await renameCustomer(target.id, renameValue);
        toast(`Renamed to ${formatCustomerLabel(renameValue.trim() || target.name, target.type)}`);
        setRenameTarget(null);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not rename customer.", "error");
      }
    });
  }

  return (
    <div>
      {customers.length > 0 && (
        <div className="mb-3.5">
          <input
            className="field max-w-sm"
            placeholder="Search customer name…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <Card>
        <table className="soft-table">
          <thead>
            <tr>
              {["Customer", "Type", "Credit balance", ""].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-sm themed-muted py-8 text-center">
                  No customers match this search.
                </td>
              </tr>
            ) : (
              filtered.map((c) => {
              const remaining = remainingCreditForCustomer(c.id, bills, payments);
              const credit = displayedCustomerCredit(c.creditBalance, remaining);
              return (
              <React.Fragment key={c.id}>
                <tr>
                  <td className="font-semibold themed-title">{formatCustomerLabel(c.name, c.type)}</td>
                  <td>
                    <Tag tone="teal">{c.type}</Tag>
                  </td>
                  <td
                    className={`font-semibold ${
                      credit > 0
                        ? "text-[#E07A3A]"
                        : credit < 0
                          ? "text-[#3DC97A]"
                          : "themed-muted"
                    }`}
                  >
                    {inr(credit)}
                  </td>
                  <td>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="btn text-xs"
                        onClick={() => setOpenId(openId === c.id ? null : c.id)}
                      >
                        {openId === c.id ? "Close" : "Bills"}
                      </button>
                      <button
                        className="btn text-xs px-2.5 py-1"
                        title="Rename customer"
                        disabled={pending}
                        onClick={() => {
                          setRenameTarget(c);
                          setRenameValue(c.name);
                        }}
                      >
                        <Pencil size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
                {openId === c.id && (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--surface-soft)" }}>
                      <CustomerBills
                        customer={c}
                        bills={bills.filter((b) => b.customerId === c.id)}
                        payments={payments}
                        onOpenBill={onOpenBill}
                      />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            );
            })
            )}
          </tbody>
        </table>
      </Card>

      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setRenameTarget(null)}>
          <div
            className="rounded-2xl p-4 w-[min(420px,calc(100%-2rem))]"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="font-semibold themed-title mb-2">Rename customer</div>
            <input
              className="field w-full mb-3"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
            />
            <div className="text-xs themed-muted mb-3">
              Shown as {formatCustomerLabel(renameValue.trim() || renameTarget.name, renameTarget.type)}
            </div>
            <div className="flex justify-end gap-2">
              <button className="btn" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="btn btn-primary" disabled={pending || !renameValue.trim()} onClick={saveRename}>
                Save name
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
