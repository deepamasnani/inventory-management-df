"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, CreditCard, Search } from "lucide-react";
import { Card } from "./ui/Card";
import { inr, isShopLocation } from "@/lib/constants";
import { filterLowStockByWarehouse } from "@/lib/notifications";

type LowStockItem = {
  skuId: number;
  warehouseId: number;
  sku: string;
  brand: string;
  warehouse: string;
  category: string;
  qty: number;
};

type Customer = { id: number; name: string; type: string; creditBalance: number };
type Warehouse = { id: number; name: string; kind?: string | null };

export default function NotificationsTab({
  lowStock,
  creditCustomers,
  warehouses,
  onLowStockClick,
  onCustomerClick,
}: {
  lowStock: LowStockItem[];
  creditCustomers: Customer[];
  warehouses: Warehouse[];
  onLowStockClick: (item: LowStockItem) => void;
  onCustomerClick: (customerId: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "stock" | "credit">("all");
  const [warehouseId, setWarehouseId] = useState<number | null>(null);
  const q = query.trim().toLowerCase();

  const godowns = warehouses.filter((w) => !isShopLocation(w));
  const scopedStock = filterLowStockByWarehouse(lowStock, warehouseId);

  const stockItems = useMemo(() => {
    if (!q) return scopedStock;
    return scopedStock.filter((item) =>
      `${item.brand} ${item.sku} ${item.category} ${item.warehouse}`.toLowerCase().includes(q)
    );
  }, [scopedStock, q]);

  const creditItems = useMemo(() => {
    if (!q) return creditCustomers;
    return creditCustomers.filter((c) => c.name.toLowerCase().includes(q));
  }, [creditCustomers, q]);

  const showStock = filter === "all" || filter === "stock";
  const showCredit = filter === "all" || filter === "credit";
  const empty =
    (showStock ? stockItems.length : 0) + (showCredit ? creditItems.length : 0) === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2.5 items-center">
        <div className="relative flex-1 min-w-[220px]" style={{ maxWidth: 420 }}>
          <Search
            size={14}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none"
          />
          <input
            className="field field-search"
            style={{ width: "100%" }}
            placeholder="Search alerts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="field min-w-[200px] w-[240px]"
          value={warehouseId ?? ""}
          onChange={(e) => setWarehouseId(e.target.value ? Number(e.target.value) : null)}
        >
          <option value="">All godowns</option>
          {godowns.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
        {(
          [
            ["all", `All (${scopedStock.length + creditCustomers.length})`],
            ["stock", `Low stock (${scopedStock.length})`],
            ["credit", `Credit (${creditCustomers.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className="btn text-xs"
            style={
              filter === id
                ? { background: "var(--color-brand-soft)", color: "var(--accent)", borderColor: "transparent" }
                : undefined
            }
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {empty ? (
        <Card>
          <div className="py-12 text-center">
            <CheckCircle2 size={32} className="mx-auto mb-2 text-[#3DC97A]" />
            <div className="text-sm font-medium themed-title">
              {q || filter !== "all" || warehouseId != null ? "No alerts match this filter" : "No notifications"}
            </div>
            <div className="text-xs themed-muted mt-1">
              Low stock is under 8 pairs, including 0. Credit alerts are customers with a positive balance.
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {showStock && stockItems.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <AlertTriangle size={15} className="text-[#E05A5A]" />
                <div className="font-semibold text-sm themed-title">Low stock</div>
                <span className="text-[11px] themed-muted ml-auto">{stockItems.length}</span>
              </div>
              <div>
                {stockItems.map((item, i) => (
                  <button
                    key={`${item.warehouseId}-${item.skuId}-${item.category}-${i}`}
                    type="button"
                    className="w-full text-left px-4 py-3 bg-transparent border-none hover:opacity-90"
                    style={i < stockItems.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                    onClick={() => onLowStockClick(item)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold themed-title truncate">
                          {item.brand} {item.sku}
                        </div>
                        <div className="text-[11px] themed-muted mt-0.5">
                          {item.category} · {item.warehouse}
                        </div>
                      </div>
                      <span
                        className="font-bold text-sm px-2.5 py-1 rounded-full shrink-0"
                        style={{
                          background:
                            item.qty <= 3
                              ? "color-mix(in srgb, #E05A5A 18%, var(--surface))"
                              : "color-mix(in srgb, #E07A3A 18%, var(--surface))",
                          color: item.qty <= 3 ? "#E05A5A" : "#E07A3A",
                        }}
                      >
                        {item.qty} pairs
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {showCredit && creditItems.length > 0 && (
            <Card className="!p-0 overflow-hidden">
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <CreditCard size={15} className="text-[#E07A3A]" />
                <div className="font-semibold text-sm themed-title">Outstanding credit</div>
                <span className="text-[11px] themed-muted ml-auto">{creditItems.length}</span>
              </div>
              <div>
                {creditItems.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    className="w-full text-left px-4 py-3 bg-transparent border-none hover:opacity-90"
                    style={i < creditItems.length - 1 ? { borderBottom: "1px solid var(--border)" } : undefined}
                    onClick={() => onCustomerClick(c.id)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold themed-title truncate">{c.name}</div>
                        <div className="text-[11px] themed-muted mt-0.5">Type {c.type}</div>
                      </div>
                      <span className="text-sm font-semibold themed-title shrink-0">{inr(c.creditBalance)}</span>
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
