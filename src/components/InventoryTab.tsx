"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Search, Plus, IndianRupee, Check, Trash2, Folder, FolderOpen, ChevronRight } from "lucide-react";
import { Card, Label } from "./ui/Card";
import { ModalShell } from "./ui/ModalShell";
import { CAT_LABELS, CUSTOMER_TYPES, inr } from "@/lib/constants";
import { adjustStock, addSku, updateSkuPrices } from "@/lib/actions";
import type { SkuWithDetails } from "@/lib/actions";
import { useToast } from "./ui/Toast";

type Warehouse = { id: number; name: string };

export type InventoryFocus = {
  warehouseId: number;
  skuId: number;
  /** Changes on each click so the same product can be re-highlighted. */
  key: number;
};

function StockCell({
  qty,
  onSave,
}: {
  qty: number;
  onSave: (v: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(qty));

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        className="field w-16 p-1 text-center font-mono"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={() => {
          onSave(Number(val) || 0);
          setEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onSave(Number(val) || 0);
            setEditing(false);
          }
        }}
      />
    );
  }
  return (
    <button
      onClick={() => {
        setVal(String(qty));
        setEditing(true);
      }}
      className="border rounded-xl px-3 py-1.5 font-semibold min-w-[44px]"
      style={
        qty < 8
          ? {
              background: "color-mix(in srgb, #E05A5A 16%, var(--surface))",
              color: "#E05A5A",
              borderColor: "color-mix(in srgb, #E05A5A 35%, var(--border))",
            }
          : {
              background: "var(--surface-soft)",
              color: "var(--text)",
              borderColor: "var(--border-strong)",
            }
      }
    >
      {qty}
    </button>
  );
}

export default function InventoryTab({
  skus,
  warehouses,
  initialQuery = "",
  focusTarget = null,
  onFocusHandled,
}: {
  skus: SkuWithDetails[];
  warehouses: Warehouse[];
  initialQuery?: string;
  focusTarget?: InventoryFocus | null;
  onFocusHandled?: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(
    focusTarget?.warehouseId ?? warehouses[0]?.id
  );
  const [query, setQuery] = useState(initialQuery);
  const [showAdd, setShowAdd] = useState(false);
  const [priceSkuId, setPriceSkuId] = useState<number | null>(null);
  const [highlightSkuId, setHighlightSkuId] = useState<number | null>(
    focusTarget?.skuId ?? null
  );
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    if (initialQuery) setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    if (!focusTarget) return;

    const whExists = warehouses.some((w) => w.id === focusTarget.warehouseId);
    if (whExists) setWarehouseId(focusTarget.warehouseId);

    setQuery("");
    setHighlightSkuId(focusTarget.skuId);
    const focusedSku = skus.find((s) => s.id === focusTarget.skuId);
    if (focusedSku) {
      setOpenBrands((prev) => ({ ...prev, [focusedSku.brand]: true }));
    }

    const scrollTimer = window.setTimeout(() => {
      rowRefs.current[focusTarget.skuId]?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 120);

    const clearTimer = window.setTimeout(() => {
      setHighlightSkuId(null);
      onFocusHandled?.();
    }, 3200);

    return () => {
      window.clearTimeout(scrollTimer);
      window.clearTimeout(clearTimer);
    };
  }, [focusTarget?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  const effectiveWhId = warehouses.some((w) => w.id === warehouseId)
    ? warehouseId
    : warehouses[0]?.id;

  const q = query.toLowerCase().trim();
  const filtered = skus.filter((s) =>
    (s.name + s.brand).toLowerCase().includes(q)
  );

  const brandGroups = filtered.reduce<Record<string, SkuWithDetails[]>>((acc, sku) => {
    const brand = sku.brand.trim() || "Unbranded";
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(sku);
    return acc;
  }, {});

  const brandNames = Object.keys(brandGroups).sort((a, b) => a.localeCompare(b));

  const priceSku = skus.find((s) => s.id === priceSkuId) || null;

  function isBrandOpen(brand: string) {
    if (q) return true;
    if (openBrands[brand] !== undefined) return openBrands[brand];
    return brandNames.length <= 1;
  }

  function toggleBrand(brand: string) {
    setOpenBrands((prev) => ({ ...prev, [brand]: !isBrandOpen(brand) }));
  }

  function handleAdjust(catId: number, newQty: number) {
    startTransition(async () => {
      await adjustStock(catId, effectiveWhId, newQty);
      toast("Stock updated");
    });
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5 gap-2.5 flex-wrap">
        <div className="flex gap-2.5 items-center">
          <select
            className="field w-[210px]"
            value={effectiveWhId}
            onChange={(e) => setWarehouseId(Number(e.target.value))}
          >
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
          <div className="relative shrink-0" style={{ width: 360, maxWidth: "100%" }}>
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none"
            />
            <input
              className="field field-search"
              style={{ width: "100%" }}
              placeholder="Search brand"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
          <Plus size={14} className="inline -mt-0.5" /> Add SKU
        </button>
      </div>

      {brandNames.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm themed-muted">No articles match this search.</div>
        </Card>
      ) : (
        <div className="flex flex-col gap-2.5">
          {brandNames.map((brand) => {
            const articles = brandGroups[brand];
            const open = isBrandOpen(brand);
            const pairCount = articles.reduce((sum, sku) => {
              return (
                sum +
                sku.categories.reduce((inner, c) => inner + (sku.stock[effectiveWhId]?.[c.id] ?? 0), 0)
              );
            }, 0);
            return (
              <Card key={brand} className="!p-0 overflow-hidden">
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-none"
                  style={{ background: "transparent", color: "var(--text)" }}
                  onClick={() => toggleBrand(brand)}
                >
                  <ChevronRight
                    size={16}
                    className="themed-muted shrink-0 transition-transform"
                    style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
                  />
                  {open ? (
                    <FolderOpen size={18} style={{ color: "var(--accent)" }} />
                  ) : (
                    <Folder size={18} className="themed-muted" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold themed-title">{brand}</div>
                    <div className="text-[11px] themed-muted mt-0.5">
                      {articles.length} article{articles.length === 1 ? "" : "s"} · {pairCount} pairs
                    </div>
                  </div>
                </button>

                {open && (
                  <div style={{ borderTop: "1px solid var(--border)" }}>
                    {articles.map((s, idx) => (
                      <div
                        key={s.id}
                        ref={(el) => {
                          rowRefs.current[s.id] = el;
                        }}
                        className={`flex flex-wrap items-start justify-between gap-3 px-4 py-3.5 ${
                          highlightSkuId === s.id ? "inventory-highlight" : ""
                        }`}
                        style={
                          idx < articles.length - 1
                            ? { borderBottom: "1px solid var(--border)" }
                            : undefined
                        }
                      >
                        <div className="min-w-[140px]">
                          <div className="text-[11px] themed-muted mb-0.5">Article</div>
                          <div className="font-semibold themed-title">{s.name}</div>
                        </div>
                        <div className="flex-1 min-w-[200px]">
                          <div className="flex flex-wrap gap-2.5">
                            {s.categories.map((c) => {
                              const qty = s.stock[effectiveWhId]?.[c.id] ?? 0;
                              return (
                                <div key={c.id} className="text-center min-w-[72px]">
                                  <div className="text-[10px] themed-muted mb-1 font-medium">
                                    {c.label}
                                  </div>
                                  <StockCell
                                    qty={qty}
                                    onSave={(v) => handleAdjust(c.id, v)}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                        <button
                          className="btn text-xs px-2.5 py-1 shrink-0"
                          onClick={() => setPriceSkuId(s.id)}
                        >
                          <IndianRupee size={12} className="inline -mt-0.5" /> Prices
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {showAdd && (
        <AddSkuModal
          warehouses={warehouses}
          onClose={() => setShowAdd(false)}
        />
      )}
      {priceSku && (
        <EditPricesModal
          sku={priceSku}
          onClose={() => setPriceSkuId(null)}
        />
      )}
    </div>
  );
}

type SizeDraft = {
  key: number;
  label: string;
  A: string;
  B: string;
  C: string;
  D: string;
  qty: string;
};

function defaultSizeRows(): SizeDraft[] {
  return CAT_LABELS.map((label, i) => ({
    key: i + 1,
    label,
    A: "",
    B: "",
    C: "",
    D: "",
    qty: "",
  }));
}

function AddSkuModal({
  warehouses,
  onClose,
}: {
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [sizes, setSizes] = useState<SizeDraft[]>(defaultSizeRows);
  const nextKey = useRef(CAT_LABELS.length + 1);
  const [stockWhId, setStockWhId] = useState(warehouses[0]?.id);
  const [applyAll, setApplyAll] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function updateSize(key: number, patch: Partial<SizeDraft>) {
    setSizes((prev) => prev.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  }

  function addSize() {
    const key = nextKey.current++;
    setSizes((prev) => [
      ...prev,
      { key, label: "", A: "", B: "", C: "", D: "", qty: "" },
    ]);
  }

  function removeSize(key: number) {
    setSizes((prev) => prev.filter((s) => s.key !== key));
  }

  function submit() {
    if (!name.trim() || !brand.trim()) return;
    const named = sizes.filter((s) => s.label.trim());
    if (named.length === 0) {
      toast("Add at least one size");
      return;
    }

    const categories = named.map((s) => ({
      label: s.label.trim(),
      priceA: Number(s.A) || 0,
      priceB: Number(s.B) || 0,
      priceC: Number(s.C) || 0,
      priceD: Number(s.D) || 0,
    }));

    const initialStock: Record<number, number[]> = {};
    warehouses.forEach((w) => {
      initialStock[w.id] = named.map((s) => {
        const qty = Number(s.qty) || 0;
        return w.id === stockWhId || applyAll ? qty : 0;
      });
    });

    startTransition(async () => {
      await addSku({ name: name.trim(), brand: brand.trim(), categories, initialStock });
      toast(`SKU "${name.trim()}" added successfully`);
      onClose();
    });
  }

  return (
    <ModalShell title="Add new SKU" onClose={onClose} wide>
      <div className="flex gap-2.5 mb-3">
        <div className="flex-1">
          <Label>SKU name</Label>
          <input className="field" placeholder="e.g. Air Zoom Flex" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Brand</Label>
          <input className="field" placeholder="e.g. Nike" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
      </div>

      <Label>Price per size category × customer type (₹)</Label>
      <table className="w-full border-collapse mt-1.5">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Category</th>
            {CUSTOMER_TYPES.map((t) => (
              <th key={t.id} className="text-center text-[11px] uppercase themed-muted p-2">{t.id}</th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s.key}>
              <td className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={s.label}
                  placeholder="e.g. UK 14-15"
                  onChange={(e) => updateSize(s.key, { label: e.target.value })}
                />
              </td>
              {(["A", "B", "C", "D"] as const).map((t) => (
                <td key={t} className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
                  <input
                    className="field text-center font-mono"
                    type="number"
                    value={s[t]}
                    onChange={(e) => updateSize(s.key, { [t]: e.target.value })}
                    placeholder="0"
                  />
                </td>
              ))}
              <td className="p-2 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border-none flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, #E05A5A 14%, var(--surface))", color: "#E05A5A" }}
                  title="Remove size"
                  onClick={() => removeSize(s.key)}
                >
                  <Trash2 size={14} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn text-xs mt-2" onClick={addSize}>
        <Plus size={13} className="inline -mt-0.5" /> Add size
      </button>

      <div className="mt-4">
        <Label>Initial stock (pairs) per size category</Label>
      </div>
      <div className="flex gap-2.5 items-center mb-2">
        <select className="field w-[220px]" value={stockWhId} onChange={(e) => setStockWhId(Number(e.target.value))} disabled={applyAll}>
          {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-xs themed-muted">
          <input type="checkbox" checked={applyAll} onChange={(e) => setApplyAll(e.target.checked)} />
          Apply same qty to all {warehouses.length} warehouses
        </label>
      </div>
      {sizes.length === 0 ? (
        <div className="text-xs themed-muted py-3">Add a size above to enter opening stock.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {sizes.map((s) => (
            <div key={s.key}>
              <div className="text-xs themed-muted mb-1 truncate">
                {s.label.trim() || "Untitled size"}
              </div>
              <input
                className="field font-mono text-center"
                type="number"
                placeholder="0"
                value={s.qty}
                onChange={(e) => updateSize(s.key, { qty: e.target.value })}
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending}>Add SKU</button>
      </div>
    </ModalShell>
  );
}

function EditPricesModal({
  sku,
  onClose,
}: {
  sku: SkuWithDetails;
  onClose: () => void;
}) {
  const [prices, setPrices] = useState(() => {
    const map: Record<number, { A: string; B: string; C: string; D: string }> = {};
    sku.categories.forEach((c) => {
      map[c.id] = {
        A: String(c.prices.A),
        B: String(c.prices.B),
        C: String(c.prices.C),
        D: String(c.prices.D),
      };
    });
    return map;
  });
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit() {
    const cleaned: Record<number, { A: number; B: number; C: number; D: number }> = {};
    sku.categories.forEach((c) => {
      cleaned[c.id] = {
        A: Number(prices[c.id].A) || 0,
        B: Number(prices[c.id].B) || 0,
        C: Number(prices[c.id].C) || 0,
        D: Number(prices[c.id].D) || 0,
      };
    });
    startTransition(async () => {
      await updateSkuPrices(cleaned);
      toast("Prices updated successfully");
      onClose();
    });
  }

  return (
    <ModalShell title={`${sku.brand} ${sku.name} — prices`} onClose={onClose} wide>
      <Label>Price per size category × customer type (₹)</Label>
      <table className="w-full border-collapse mt-1.5">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Category</th>
            {CUSTOMER_TYPES.map((t) => (
              <th key={t.id} className="text-center text-[11px] uppercase themed-muted p-2">{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sku.categories.map((c) => (
            <tr key={c.id}>
              <td className="p-2 text-sm font-semibold border-b border-stone-100">{c.label}</td>
              {(["A", "B", "C", "D"] as const).map((t) => (
                <td key={t} className="p-2 border-b border-stone-100">
                  <input
                    className="field text-center font-mono"
                    type="number"
                    value={prices[c.id][t]}
                    onChange={(e) =>
                      setPrices((prev) => ({
                        ...prev,
                        [c.id]: { ...prev[c.id], [t]: e.target.value },
                      }))
                    }
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="text-xs themed-muted mt-2.5">
        Changes apply to new bills only — existing bills keep the price charged at the time.
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending}>Save prices</button>
      </div>
    </ModalShell>
  );
}
