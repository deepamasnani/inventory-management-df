"use client";

import { Printer } from "lucide-react";
import { inr } from "@/lib/constants";

type BillForPrint = {
  invoiceNo: string;
  date: string;
  customerName: string;
  warehouseName: string;
  subtotal: number;
  discount: number;
  claim: number;
  total: number;
  paidCash: number;
  paidOnline: number;
  balance: number;
  items: {
    brand: string;
    skuName: string;
    categoryLabel: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
};

/** Print receipts stay paper-white with dark ink in both themes. */
export default function PrintModal({
  bill,
  onClose,
}: {
  bill: BillForPrint;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]">
      <div
        className="w-[460px] rounded-[10px] p-6 max-h-[88vh] overflow-y-auto shadow-2xl"
        style={{ background: "#ffffff", color: "#1C2333" }}
      >
        <div className="print-area" style={{ color: "#1C2333" }}>
          <div className="text-center mb-2.5">
            <div className="font-display font-bold text-xl" style={{ color: "#1C2333" }}>
              Dev Footwear Co.
            </div>
            <div className="text-[11px]" style={{ color: "#5B6478" }}>
              {bill.warehouseName}
            </div>
          </div>

          <div className="my-4" style={{ borderTop: "2px dashed #D6DAD3" }} />

          <div className="flex justify-between text-xs mb-2.5" style={{ color: "#1C2333" }}>
            <span>
              Bill <b className="font-mono">{bill.invoiceNo}</b>
            </span>
            <span>{bill.date}</span>
          </div>
          <div className="text-sm mb-2.5" style={{ color: "#1C2333" }}>
            Billed to: <b>{bill.customerName}</b>
          </div>

          <table className="w-full border-collapse">
            <thead>
              <tr>
                {["Item", "Qty", "Amount"].map((h) => (
                  <th
                    key={h}
                    className={`text-[11px] uppercase p-2 ${
                      h === "Qty" ? "text-center" : h === "Amount" ? "text-right" : "text-left"
                    }`}
                    style={{ color: "#5B6478", borderBottom: "2px dashed #D6DAD3" }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bill.items.map((it, i) => (
                <tr key={i}>
                  <td className="p-2 text-sm" style={{ color: "#1C2333", borderBottom: "1px solid #EEE" }}>
                    {it.brand} {it.skuName}
                    <br />
                    <span className="text-[11px]" style={{ color: "#5B6478" }}>
                      {it.categoryLabel} · {inr(it.price)}/pr
                    </span>
                  </td>
                  <td
                    className="p-2 text-sm text-center"
                    style={{ color: "#1C2333", borderBottom: "1px solid #EEE" }}
                  >
                    {it.qty}
                  </td>
                  <td
                    className="p-2 text-sm text-right font-mono"
                    style={{ color: "#1C2333", borderBottom: "1px solid #EEE" }}
                  >
                    {inr(it.subtotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="my-4" style={{ borderTop: "2px dashed #D6DAD3" }} />

          <div className="flex justify-between text-sm" style={{ color: "#5B6478" }}>
            <span>Subtotal</span>
            <span className="font-mono">{inr(bill.subtotal)}</span>
          </div>
          {bill.discount > 0 && (
            <div className="flex justify-between text-sm" style={{ color: "#5B6478" }}>
              <span>Discount</span>
              <span className="font-mono">−{inr(bill.discount)}</span>
            </div>
          )}
          {bill.claim > 0 && (
            <div className="flex justify-between text-sm" style={{ color: "#5B6478" }}>
              <span>Applied from credit</span>
              <span className="font-mono">−{inr(bill.claim)}</span>
            </div>
          )}
          <div className="flex justify-between text-[15px] font-bold mt-1" style={{ color: "#1C2333" }}>
            <span>Total</span>
            <span className="font-mono">{inr(bill.total)}</span>
          </div>
          <div className="flex justify-between text-sm mt-1.5" style={{ color: "#1C2333" }}>
            <span>Amount paid</span>
            <span className="font-mono">{inr(bill.paidCash + bill.paidOnline)}</span>
          </div>
          {bill.balance !== 0 && (
            <div
              className="flex justify-between text-sm"
              style={{ color: bill.balance > 0 ? "#C77C2C" : "#2E7D5B" }}
            >
              <span>{bill.balance > 0 ? "Balance due (added to credit)" : "Credit reduced"}</span>
              <span className="font-mono">{inr(Math.abs(bill.balance))}</span>
            </div>
          )}
          <div className="mt-4 text-center text-[11px]" style={{ color: "#5B6478" }}>
            Thank you for your business.
          </div>
        </div>

        <div className="no-print flex gap-2 mt-4 justify-end">
          <button className="btn" onClick={onClose} style={{ color: "#1C2333", background: "#fff", borderColor: "#D6DAD3" }}>
            Close
          </button>
          <button className="btn btn-primary" onClick={() => window.print()}>
            <Printer size={13} className="inline -mt-0.5" /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
