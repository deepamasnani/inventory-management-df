"use client";

import React, { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Printer } from "lucide-react";
import { Card, Label } from "./ui/Card";
import { ModalShell } from "./ui/ModalShell";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { Tag } from "./ui/Tag";
import { CUSTOMER_TYPES, inr } from "@/lib/constants";
import { dispatchBill, getBillItems, voidBill } from "@/lib/actions";
import {
  initialBillCredit,
  paymentsForBill,
  remainingBillCredit,
  type PaymentCreditFields,
} from "@/lib/bill-credit";
import { BillCreditPayForm, BillPaymentBreakdown } from "./BillPaymentDetails";
import { useToast } from "./ui/Toast";

type Bill = {
  id: number;
  invoiceNo: string;
  date: string;
  customerName: string;
  customerType: string;
  warehouseName: string;
  subtotal: number;
  discount: number;
  claim: number;
  total: number;
  paidCash: number;
  paidOnline: number;
  balance: number;
  status?: string | null;
  dispatchStatus?: string | null;
};

type BillItem = {
  skuName: string;
  brand: string;
  categoryLabel: string;
  qty: number;
  price: number;
  subtotal: number;
};

function DetailRow({ label, value, mono, strong }: { label: string; value: string; mono?: boolean; strong?: boolean }) {
  return (
    <>
      <div className="themed-muted">{label}</div>
      <div className={`text-right themed-title ${mono ? "font-mono" : ""} ${strong ? "font-bold" : ""}`}>{value}</div>
    </>
  );
}

export default function BillsTab({
  bills,
  payments,
  onReprint,
  initialQuery = "",
  initialOpenId = null,
}: {
  bills: Bill[];
  payments: PaymentCreditFields[];
  onReprint: (bill: Bill & { items: BillItem[] }) => void;
  initialQuery?: string;
  initialOpenId?: number | null;
}) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [openItems, setOpenItems] = useState<BillItem[]>([]);
  const [query, setQuery] = useState(initialQuery);
  const [pending, startTransition] = useTransition();
  const [voidTarget, setVoidTarget] = useState<Bill | null>(null);
  const { toast } = useToast();
  const router = useRouter();

  const openBill = bills.find((b) => b.id === openId);
  const q = query.toLowerCase().trim();
  const filtered = bills.filter((b) =>
    `${b.invoiceNo} ${b.customerName} ${b.warehouseName} ${b.date}`.toLowerCase().includes(q)
  );

  function handleOpen(billId: number) {
    startTransition(async () => {
      const items = await getBillItems(billId);
      setOpenItems(items);
      setOpenId(billId);
    });
  }

  function handleDispatch(bill: Bill) {
    startTransition(async () => {
      try {
        await dispatchBill(bill.id);
        toast(`Dispatched ${bill.invoiceNo}`, "info");
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not dispatch this bill.", "error");
      }
    });
  }

  function confirmVoid() {
    if (!voidTarget) return;
    const target = voidTarget;
    startTransition(async () => {
      try {
        await voidBill(target.id);
        toast(`Voided ${target.invoiceNo} — stock and credit restored`, "info");
        setVoidTarget(null);
        setOpenId(null);
        router.refresh();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not void this bill.", "error");
      }
    });
  }

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (initialOpenId) {
      setExpandedId(initialOpenId);
      handleOpen(initialOpenId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOpenId]);

  return (
    <div>
      {bills.length > 0 && (
        <div className="mb-3.5">
          <input
            className="field max-w-sm"
            placeholder="Filter by bill, customer, warehouse…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      )}
      <Card>
        {bills.length === 0 ? (
          <div className="text-sm themed-muted py-8 text-center">No bills created yet — generate one from the &quot;New Bill&quot; tab.</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm themed-muted py-8 text-center">No bills match this search.</div>
        ) : (
          <table className="soft-table">
            <thead>
              <tr>
                {["Bill", "Date", "Customer", "Warehouse", "Total", "Credit left", ""].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const remaining = remainingBillCredit(b, payments);
                const initial = initialBillCredit(b);
                const open = expandedId === b.id;
                return (
                <React.Fragment key={b.id}>
                <tr>
                  <td className="font-semibold themed-title">
                    {b.invoiceNo}
                    {b.status === "voided" ? (
                      <span className="ml-2"><Tag tone="amber">Voided</Tag></span>
                    ) : b.dispatchStatus === "dispatched" ? (
                      <span className="ml-2"><Tag tone="green">Dispatched</Tag></span>
                    ) : (
                      <span className="ml-2"><Tag tone="amber">Pending dispatch</Tag></span>
                    )}
                  </td>
                  <td className="themed-muted">{b.date}</td>
                  <td className="themed-muted">{b.customerName}</td>
                  <td className="themed-muted">{b.warehouseName}</td>
                  <td className="font-semibold themed-title">{inr(b.total)}</td>
                  <td className={`font-semibold ${remaining > 0 ? "text-[#E07A3A]" : "themed-muted"}`}>
                    {remaining > 0
                      ? `${inr(remaining)}${initial > remaining ? ` of ${inr(initial)}` : ""}`
                      : initial > 0
                        ? "Paid"
                        : "—"}
                  </td>
                  <td className="whitespace-nowrap">
                    <button className="btn text-xs" onClick={() => setExpandedId(open ? null : b.id)}>
                      {open ? <ChevronDown size={13} className="inline" /> : <ChevronRight size={13} className="inline" />}{" "}
                      Payments
                    </button>
                    <button className="btn text-xs ml-1.5" onClick={() => handleOpen(b.id)}>View</button>
                    {b.status !== "voided" && b.dispatchStatus !== "dispatched" ? (
                      <button className="btn btn-primary text-xs ml-1.5" disabled={pending} onClick={() => handleDispatch(b)}>
                        Dispatch
                      </button>
                    ) : null}
                  </td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={7} style={{ background: "var(--surface-soft)" }}>
                      <div className="p-3">
                        <BillCreditPayForm bill={b} remaining={remaining} />
                        <BillPaymentBreakdown payments={paymentsForBill(b, payments)} />
                      </div>
                    </td>
                  </tr>
                )}
                </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {openBill && (
        <ModalShell title={`Bill ${openBill.invoiceNo}`} onClose={() => setOpenId(null)} wide>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm mb-3.5">
            <DetailRow label="Date" value={openBill.date} />
            <DetailRow label="Warehouse" value={openBill.warehouseName} />
            <DetailRow label="Customer" value={openBill.customerName} />
            <DetailRow label="Billing type" value={CUSTOMER_TYPES.find((t) => t.id === openBill.customerType)?.label || openBill.customerType} />
            <DetailRow
              label="Dispatch"
              value={
                openBill.status === "voided"
                  ? "Voided"
                  : openBill.dispatchStatus === "dispatched"
                    ? "Dispatched"
                    : "Pending dispatch"
              }
            />
          </div>

          <Label>Items</Label>
          <table className="w-full border-collapse mb-3.5">
            <thead>
              <tr>
                <th className="text-left text-[11px] uppercase themed-muted p-2">Item</th>
                <th className="text-left text-[11px] uppercase themed-muted p-2">Size</th>
                <th className="text-center text-[11px] uppercase themed-muted p-2">Qty</th>
                <th className="text-right text-[11px] uppercase themed-muted p-2">Price</th>
                <th className="text-right text-[11px] uppercase themed-muted p-2">Amount</th>
              </tr>
            </thead>
            <tbody>
              {openItems.map((it, i) => (
                <tr key={i}>
                  <td className="p-2 text-sm border-b border-stone-100">{it.brand} {it.skuName}</td>
                  <td className="p-2 text-sm themed-muted">{it.categoryLabel}</td>
                  <td className="p-2 text-sm border-b border-stone-100 text-center">{it.qty}</td>
                  <td className="p-2 text-sm border-b border-stone-100 text-right font-mono">{inr(it.price)}</td>
                  <td className="p-2 text-sm border-b border-stone-100 text-right font-mono">{inr(it.subtotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
            <DetailRow label="Subtotal" value={inr(openBill.subtotal)} mono />
            <DetailRow label="Discount" value={inr(openBill.discount)} mono />
            <DetailRow label="Claim (from credit)" value={inr(openBill.claim)} mono />
            <DetailRow label="Total payable" value={inr(openBill.total)} mono strong />
            <DetailRow label="Paid — cash" value={inr(openBill.paidCash)} mono />
            <DetailRow label="Paid — online" value={inr(openBill.paidOnline)} mono />
            <DetailRow label="Balance this bill" value={inr(openBill.balance)} mono />
            <DetailRow
              label="Credit remaining"
              value={inr(remainingBillCredit(openBill, payments))}
              mono
            />
            <DetailRow label="Net credit change" value={inr(openBill.balance + openBill.claim)} mono />
          </div>

          <div className="flex justify-end gap-2 mt-4">
            <button className="btn" onClick={() => setOpenId(null)}>Close</button>
            {openBill.status !== "voided" && openBill.dispatchStatus !== "dispatched" && (
              <button className="btn btn-primary" disabled={pending} onClick={() => handleDispatch(openBill)}>
                Dispatch
              </button>
            )}
            {openBill.status !== "voided" && (
              <button className="btn" style={{ color: "#E05A5A" }} onClick={() => setVoidTarget(openBill)}>
                Void bill
              </button>
            )}
            <button className="btn btn-primary" onClick={() => onReprint({ ...openBill, items: openItems })}>
              <Printer size={13} className="inline -mt-0.5" /> View printable copy
            </button>
          </div>
        </ModalShell>
      )}
      {voidTarget && (
        <ConfirmDialog
          danger
          title={`Void ${voidTarget.invoiceNo}?`}
          message="Pairs go back to that warehouse and the customer's credit is reversed. The bill stays in history as voided."
          confirmLabel={pending ? "Voiding…" : "Void bill"}
          onConfirm={confirmVoid}
          onCancel={() => setVoidTarget(null)}
        />
      )}
    </div>
  );
}
