"use client";

import {
  Package,
  IndianRupee,
  CreditCard,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { Card, StitchDivider } from "./ui/Card";
import { StatCard } from "./ui/StatCard";
import { Tag } from "./ui/Tag";
import { inr } from "@/lib/constants";

type LowStockItem = {
  skuId: number;
  warehouseId: number;
  sku: string;
  brand: string;
  warehouse: string;
  category: string;
  qty: number;
};

type Props = {
  totalSkus: number;
  totalPairs: number;
  inventoryValue: number;
  outstandingCredit: number;
  revenueCollected: number;
  lowStock: LowStockItem[];
  recentBills: {
    id: number;
    invoiceNo: string;
    customerName: string;
    total: number;
    paidCash: number;
    paidOnline: number;
    balance: number;
    claim: number;
  }[];
  onNavigate?: (tab: string) => void;
  onLowStockClick?: (item: LowStockItem) => void;
};

export default function Overview({
  totalSkus,
  totalPairs,
  inventoryValue,
  outstandingCredit,
  revenueCollected,
  lowStock,
  recentBills,
  onNavigate,
  onLowStockClick,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 xl:grid-cols-5 gap-4">
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("inventory")}>
          <StatCard icon={Package} label="Total SKUs" value={totalSkus} />
        </button>
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("inventory")}>
          <StatCard icon={Package} label="Pairs in stock" value={totalPairs.toLocaleString("en-IN")} tone="blue" />
        </button>
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("inventory")}>
          <StatCard icon={IndianRupee} label="Inventory value" value={inr(inventoryValue)} tone="teal" />
        </button>
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("customers")}>
          <StatCard icon={CreditCard} label="Outstanding credit" value={inr(outstandingCredit)} tone="amber" />
        </button>
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("bills")}>
          <StatCard icon={TrendingUp} label="Revenue collected" value={inr(revenueCollected)} tone="teal" />
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--color-brand-soft)" }}
          >
            <Receipt size={20} style={{ color: "var(--accent)" }} />
          </div>
          <div className="font-bold themed-title text-[15px] mb-1">Create a new bill</div>
          <p className="text-[13px] themed-muted mb-4 leading-relaxed">
            Build invoices with warehouse stock, customer pricing, and credit claims.
          </p>
          <button className="btn btn-primary text-xs" onClick={() => onNavigate?.("billing")}>
            Start billing <ArrowRight size={13} className="inline ml-1" />
          </button>
        </Card>

        <Card>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "color-mix(in srgb, #E07A3A 16%, var(--surface))" }}
          >
            <Package size={20} className="text-[#E07A3A]" />
          </div>
          <div className="font-bold themed-title text-[15px] mb-1">Stock check</div>
          <p className="text-[13px] themed-muted mb-4 leading-relaxed">
            {lowStock.length > 0
              ? `${lowStock.length} size categories are running low across warehouses.`
              : "All sizes are comfortably stocked right now."}
          </p>
          <button className="btn text-xs" onClick={() => onNavigate?.("inventory")}>
            Open inventory <ArrowUpRight size={13} className="inline ml-1" />
          </button>
        </Card>

        <Card
          className="border-transparent text-[#F2F0F8]"
          style={{
            background: "linear-gradient(145deg, #0F766E 0%, #0E7490 100%)",
            boxShadow: "0 6px 20px rgba(15, 118, 110, 0.25)",
          }}
        >
          <div className="text-[#ecfdf8]/70 text-[11px] uppercase tracking-wide font-semibold mb-2">
            Business snapshot
          </div>
          <div className="text-3xl font-bold mb-1 text-[#ecfdf8]">{inr(revenueCollected)}</div>
          <div className="text-[#ecfdf8]/80 text-[13px] mb-5">Total revenue collected</div>
          <div className="flex gap-4 text-[12px] text-[#ecfdf8]">
            <div>
              <div className="text-[#ecfdf8]/60">Credit due</div>
              <div className="font-semibold">{inr(outstandingCredit)}</div>
            </div>
            <div>
              <div className="text-[#ecfdf8]/60">SKUs</div>
              <div className="font-semibold">{totalSkus}</div>
            </div>
            <div>
              <div className="text-[#ecfdf8]/60">Pairs</div>
              <div className="font-semibold">{totalPairs.toLocaleString("en-IN")}</div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr_1fr] gap-4">
        <Card>
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-[15px] themed-title">Recent bills</div>
            {recentBills.length > 0 && (
              <button
                className="text-xs bg-transparent border-none font-semibold flex items-center gap-1"
                style={{ color: "var(--accent)" }}
                onClick={() => onNavigate?.("bills")}
              >
                See all <ArrowRight size={12} />
              </button>
            )}
          </div>
          <StitchDivider />
          {recentBills.length === 0 ? (
            <div className="text-center py-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "var(--surface-muted)" }}
              >
                <Receipt size={24} style={{ color: "var(--text-muted)" }} />
              </div>
              <div className="text-sm themed-muted mb-3">No bills created yet</div>
              <button className="btn btn-primary text-sm" onClick={() => onNavigate?.("billing")}>
                Create your first bill
              </button>
            </div>
          ) : (
            <table className="soft-table">
              <thead>
                <tr>
                  {["Bill", "Customer", "Total", "Paid", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBills.map((b) => (
                  <tr key={b.id} className="cursor-pointer" onClick={() => onNavigate?.("bills")}>
                    <td className="font-semibold themed-title">{b.invoiceNo}</td>
                    <td className="themed-muted">{b.customerName}</td>
                    <td className="font-semibold themed-title">{inr(b.total)}</td>
                    <td className="themed-muted">{inr(b.paidCash + b.paidOnline)}</td>
                    <td>
                      {b.balance > 0 ? (
                        <Tag tone="amber">Credit</Tag>
                      ) : b.balance < 0 ? (
                        <Tag tone="green">Advance</Tag>
                      ) : (
                        <Tag tone="teal">Paid</Tag>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold text-[15px] themed-title flex items-center gap-2">
              <span
                className="w-8 h-8 rounded-xl flex items-center justify-center"
                style={{ background: "color-mix(in srgb, #E05A5A 16%, var(--surface))" }}
              >
                <AlertTriangle size={15} className="text-[#E05A5A]" />
              </span>
              Low stock
            </div>
            <span
              className="text-[10px] font-semibold px-2 py-1 rounded-full themed-muted"
              style={{ background: "var(--surface-muted)" }}
            >
              &lt; 8 pairs
            </span>
          </div>
          <StitchDivider />
          {lowStock.length === 0 ? (
            <div className="text-center py-10">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3"
                style={{ background: "color-mix(in srgb, #1F9B5A 16%, var(--surface))" }}
              >
                <Package size={24} className="text-[#3DC97A]" />
              </div>
              <div className="text-sm themed-muted">All items well stocked</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lowStock.map((r, i) => (
                <button
                  key={i}
                  className="flex justify-between items-center text-left text-[13px] p-3 rounded-2xl border transition-all cursor-pointer hover:opacity-90"
                  style={{
                    background: "var(--surface-soft)",
                    borderColor: "var(--border)",
                  }}
                  onClick={() => {
                    if (onLowStockClick) onLowStockClick(r);
                    else onNavigate?.("inventory");
                  }}
                >
                  <div>
                    <div className="font-semibold themed-title">
                      {r.brand} {r.sku}
                    </div>
                    <div className="text-[11px] themed-muted mt-0.5">
                      {r.category} · {r.warehouse}
                    </div>
                  </div>
                  <span
                    className="font-bold text-sm px-2.5 py-1 rounded-full"
                    style={{
                      background:
                        r.qty <= 3
                          ? "color-mix(in srgb, #E05A5A 18%, var(--surface))"
                          : "color-mix(in srgb, #E07A3A 18%, var(--surface))",
                      color: r.qty <= 3 ? "#E05A5A" : "#E07A3A",
                    }}
                  >
                    {r.qty}
                  </span>
                </button>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
