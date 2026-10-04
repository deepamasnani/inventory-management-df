"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Card } from "./ui/Card";
import { Tag } from "./ui/Tag";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { inr } from "@/lib/constants";
import { deleteCustomer } from "@/lib/actions";
import {
  initialBillCredit,
  paymentsForBill,
  remainingBillCredit,
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
  const outstanding = Math.max(0, customer.creditBalance);

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
  const [deleteTarget, setDeleteTarget] = useState<Customer | null>(null);
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
  const filtered = customers.filter((c) =>
    `${c.name} ${c.type}`.toLowerCase().includes(q)
  );

  function confirmDeleteCustomer() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      try {
        await deleteCustomer(target.id);
        if (openId === target.id) setOpenId(null);
        toast(`Customer "${target.name}" deleted`, "info");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not delete customer.", "error");
      }
    });
  }

  return (
    <div>
      {customers.length > 0 && (
        <div className="mb-3.5">
          <input
            className="field max-w-sm"
            placeholder="Filter customers…"
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
              filtered.map((c) => (
              <React.Fragment key={c.id}>
                <tr>
                  <td className="font-semibold themed-title">{c.name}</td>
                  <td>
                    <Tag tone="teal">{c.type}</Tag>
                  </td>
                  <td
                    className={`font-semibold ${
                      c.creditBalance > 0
                        ? "text-[#E07A3A]"
                        : c.creditBalance < 0
                          ? "text-[#3DC97A]"
                          : "themed-muted"
                    }`}
                  >
                    {inr(c.creditBalance)}
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
                        className="btn btn-danger text-xs px-2.5 py-1"
                        title="Delete customer"
                        disabled={pending}
                        onClick={() => setDeleteTarget(c)}
                      >
                        <Trash2 size={13} />
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
            ))
            )}
          </tbody>
        </table>
      </Card>

      {deleteTarget && (
        <ConfirmDialog
          title="Delete customer?"
          message={`"${deleteTarget.name}" will be permanently removed, along with their payment history and any bills under their name. This cannot be undone.`}
          confirmLabel="Delete customer"
          danger
          onConfirm={confirmDeleteCustomer}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}
