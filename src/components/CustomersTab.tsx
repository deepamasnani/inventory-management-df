"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Card } from "./ui/Card";
import { Tag } from "./ui/Tag";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { inr } from "@/lib/constants";
import { settleCredit, getPayments, deletePayment, deleteCustomer } from "@/lib/actions";
import { useToast } from "./ui/Toast";

type Customer = { id: number; name: string; type: string; creditBalance: number };
type Payment = { id: number; date: string; amount: number; method: string; note: string | null };

function CustomerDetail({ customer }: { customer: Customer }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("Cash");
  const [paymentsList, setPaymentsList] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [pending, startTransition] = useTransition();
  const [deleteTarget, setDeleteTarget] = useState<Payment | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const outstanding = Math.max(0, customer.creditBalance);
  const amountN = Number(amount) || 0;
  const exceedsCredit = amountN > outstanding;
  const canSettle = outstanding > 0 && amountN > 0 && !exceedsCredit && !pending;

  async function reloadPayments() {
    const p = await getPayments(customer.id);
    setPaymentsList(p);
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getPayments(customer.id)
      .then((p) => {
        if (!cancelled) {
          setPaymentsList(p);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [customer.id]);

  function submit() {
    const n = Number(amount);
    if (!n || n <= 0) {
      toast("Enter a valid payment amount.", "error");
      return;
    }
    if (outstanding <= 0) {
      toast("This customer has no outstanding credit to settle.", "error");
      return;
    }
    if (n > outstanding) {
      toast(`Payment cannot exceed outstanding credit of ${inr(outstanding)}.`, "error");
      return;
    }
    startTransition(async () => {
      try {
        await settleCredit(customer.id, n, method);
        toast(`₹${n.toLocaleString("en-IN")} payment recorded for ${customer.name}`);
        await reloadPayments();
        setAmount("");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not record payment.", "error");
      }
    });
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setDeleteTarget(null);
    startTransition(async () => {
      try {
        await deletePayment(target.id);
        toast(
          target.note === "Credit settlement"
            ? `Deleted settlement of ${inr(target.amount)} — credit restored`
            : `Deleted payment of ${inr(target.amount)}`,
          "info"
        );
        await reloadPayments();
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not delete payment.", "error");
      }
    });
  }

  return (
    <div className="p-3">
      <div className="text-xs themed-muted mb-2">
        {outstanding > 0 ? (
          <>
            Outstanding credit: <b className="font-mono text-[#E07A3A]">{inr(outstanding)}</b>
            {" · "}Payment cannot exceed this amount.
          </>
        ) : (
          <>No outstanding credit to settle for this customer.</>
        )}
      </div>
      <div className="flex gap-2 items-center mb-2 flex-wrap">
        <input
          className="field w-[140px]"
          type="number"
          min={0}
          max={outstanding || undefined}
          placeholder="Amount received"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          disabled={outstanding <= 0 || pending}
        />
        <select
          className="field w-[110px]"
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          disabled={outstanding <= 0 || pending}
        >
          <option>Cash</option>
          <option>Online</option>
        </select>
        <button className="btn btn-primary" onClick={submit} disabled={!canSettle}>
          Record payment against credit
        </button>
        {outstanding > 0 && (
          <button
            className="btn text-xs"
            type="button"
            disabled={pending}
            onClick={() => setAmount(String(outstanding))}
          >
            Pay full {inr(outstanding)}
          </button>
        )}
      </div>
      {exceedsCredit && amount !== "" && (
        <div className="text-xs text-[#E05A5A] mb-3">
          Entered amount is greater than outstanding credit ({inr(outstanding)}).
        </div>
      )}

      {loading ? (
        <div className="text-sm themed-muted">Loading payment history…</div>
      ) : paymentsList.length === 0 ? (
        <div className="text-sm themed-muted">No payment history yet.</div>
      ) : (
        <table className="soft-table">
          <thead>
            <tr>
              {["Date", "Amount", "Method", "Note", ""].map((h) => (
                <th key={h || "actions"}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paymentsList.map((p) => (
              <tr key={p.id}>
                <td className="themed-muted">{p.date}</td>
                <td className="font-semibold themed-title">{inr(p.amount)}</td>
                <td>
                  <Tag tone={p.method === "Cash" ? "green" : p.method === "Claim" ? "amber" : "teal"}>
                    {p.method}
                  </Tag>
                </td>
                <td className="themed-muted">{p.note}</td>
                <td className="text-right">
                  <button
                    className="btn btn-danger text-xs px-2.5 py-1"
                    title="Delete payment"
                    disabled={pending}
                    onClick={() => setDeleteTarget(p)}
                  >
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Delete this payment?"
          message={
            deleteTarget.note === "Credit settlement"
              ? `This will remove the ${inr(deleteTarget.amount)} credit settlement and restore that amount to ${customer.name}'s outstanding credit.`
              : `This will remove the ${inr(deleteTarget.amount)} ${deleteTarget.method} payment from history. Credit balance is not changed for bill payments.`
          }
          confirmLabel="Delete payment"
          danger
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

export default function CustomersTab({
  customers,
  initialQuery = "",
  initialOpenId = null,
}: {
  customers: Customer[];
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
                        {openId === c.id ? "Close" : "Details"}
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
                      <CustomerDetail customer={c} />
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
