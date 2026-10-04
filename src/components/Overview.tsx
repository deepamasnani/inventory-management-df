"use client";

import {
  Package,
  AlertTriangle,
  ArrowRight,
  Receipt,
  ArrowUpRight,
} from "lucide-react";
import { Card, StitchDivider } from "./ui/Card";
import { StatCard } from "./ui/StatCard";
import { Tag } from "./ui/Tag";
import { isShopLocation, LOW_STOCK_BELOW, warehouseCountLabel } from "@/lib/constants";

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
  lowStock: LowStockItem[];
  recentBills: {
    id: number;
    invoiceNo: string;
    customerName: string;
    status?: string | null;
    dispatchStatus?: string | null;
  }[];
  warehouseStats: { id: number; name: string; kind?: string; skuCount: number; pairs: number }[];
  onNavigate?: (tab: string) => void;
  onWarehouseClick?: (warehouseId: number) => void;
  onLowStockClick?: (item: LowStockItem) => void;
};

export default function Overview({
  totalSkus,
  totalPairs,
  lowStock,
  recentBills,
  warehouseStats,
  onNavigate,
  onWarehouseClick,
  onLowStockClick,
}: Props) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 max-w-xl">
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("inventory")}>
          <StatCard icon={Package} label="Total SKUs" value={totalSkus} />
        </button>
        <button className="text-left bg-transparent border-none p-0" onClick={() => onNavigate?.("inventory")}>
          <StatCard icon={Package} label="Pairs in stock" value={totalPairs.toLocaleString("en-IN")} tone="blue" />
        </button>
      </div>

      {warehouseStats.filter((w) => !isShopLocation(w)).length > 0 && (
        <Card>
          <div className="font-bold text-[15px] themed-title mb-1">Stock by godown</div>
          <StitchDivider />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {warehouseStats
              .filter((w) => !isShopLocation(w))
              .map((w) => (
              <button
                key={w.id}
                type="button"
                className="text-left rounded-2xl p-3.5 border transition-all hover:opacity-90"
                style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}
                onClick={() => {
                  if (onWarehouseClick) onWarehouseClick(w.id);
                  else onNavigate?.("inventory");
                }}
              >
                <div className="font-semibold themed-title text-sm">{w.name}</div>
                <div className="text-[12px] themed-muted mt-1">
                  {warehouseCountLabel(w.skuCount, w.pairs)}
                </div>
              </button>
            ))}
          </div>
        </Card>
      )}

      {warehouseStats.some((w) => isShopLocation(w)) && (
        <Card>
          <div className="font-bold text-[15px] themed-title mb-1">Shop</div>
          <StitchDivider />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
            {warehouseStats
              .filter((w) => isShopLocation(w))
              .map((w) => (
                <button
                  key={w.id}
                  type="button"
                  className="text-left rounded-2xl p-3.5 border transition-all hover:opacity-90"
                  style={{ background: "var(--surface-soft)", borderColor: "var(--border)" }}
                  onClick={() => {
                    if (onWarehouseClick) onWarehouseClick(w.id);
                    else onNavigate?.("shop");
                  }}
                >
                  <div className="font-semibold themed-title text-sm">{w.name}</div>
                  <div className="text-[12px] themed-muted mt-1">
                    {warehouseCountLabel(w.skuCount, w.pairs)}
                  </div>
                </button>
              ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <div
            className="w-11 h-11 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: "var(--color-brand-soft)" }}
          >
            <Receipt size={20} style={{ color: "var(--accent)" }} />
          </div>
          <div className="font-bold themed-title text-[15px] mb-1">Create a new bill</div>
          <p className="text-[13px] themed-muted mb-4 leading-relaxed">
            Build invoices from godown or shop stock.
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
              ? `${lowStock.length} size${lowStock.length === 1 ? "" : "s"} are at ${LOW_STOCK_BELOW - 1} pairs or fewer.`
              : "No sizes are at 0–7 pairs right now."}
          </p>
          <button className="btn text-xs" onClick={() => onNavigate?.("inventory")}>
            Open inventory <ArrowUpRight size={13} className="inline ml-1" />
          </button>
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
                  {["Bill", "Customer", "Status"].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentBills.map((b) => (
                  <tr key={b.id} className="cursor-pointer" onClick={() => onNavigate?.("bills")}>
                    <td className="font-semibold themed-title">{b.invoiceNo}</td>
                    <td className="themed-muted">{b.customerName}</td>
                    <td>
                      {b.status === "voided" ? (
                        <Tag tone="amber">Voided</Tag>
                      ) : b.dispatchStatus === "dispatched" ? (
                        <Tag tone="green">Dispatched</Tag>
                      ) : (
                        <Tag tone="amber">Pending dispatch</Tag>
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
              &lt; {LOW_STOCK_BELOW} pairs
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
              <div className="text-sm themed-muted">No sizes below {LOW_STOCK_BELOW} pairs</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {lowStock.slice(0, 8).map((r, i) => (
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
              {lowStock.length > 8 && (
                <button
                  className="text-xs bg-transparent border-none font-semibold mt-2 text-left"
                  style={{ color: "var(--accent)" }}
                  onClick={() => onNavigate?.("notifications")}
                >
                  See all {lowStock.length} low-stock alerts
                </button>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
