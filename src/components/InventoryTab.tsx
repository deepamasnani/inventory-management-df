"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { Search, Plus, IndianRupee, Trash2, Folder, FolderOpen, ChevronRight, FileSpreadsheet, Pencil, ArrowLeftRight } from "lucide-react";
import { Card, Label } from "./ui/Card";
import { ModalShell } from "./ui/ModalShell";
import { ConfirmDialog } from "./ui/ConfirmDialog";
import { CUSTOMER_TYPES, formatCartons, formatSizeRange, skuPresentInWarehouse, skuSearchHaystack, warehouseCountLabel } from "@/lib/constants";
import { adjustStock, addSku, importInventoryRows, updateSkuPrices, deleteBrandFolder, deleteSku, updateSkuDetails, transferStock } from "@/lib/actions";
import type { SkuWithDetails } from "@/lib/actions";
import { parseInventoryWorkbook } from "@/lib/parse-inventory-xlsx";
import { useToast } from "./ui/Toast";

type Warehouse = { id: number; name: string };

export type InventoryFocus = {
  warehouseId: number;
  skuId?: number;
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
  warehouseStats = [],
  initialQuery = "",
  focusTarget = null,
  onFocusHandled,
}: {
  skus: SkuWithDetails[];
  warehouses: Warehouse[];
  warehouseStats?: { id: number; skuCount: number; pairs: number }[];
  initialQuery?: string;
  focusTarget?: InventoryFocus | null;
  onFocusHandled?: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(
    focusTarget?.warehouseId ?? warehouses[0]?.id
  );
  const [query, setQuery] = useState(initialQuery);
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [priceSkuId, setPriceSkuId] = useState<number | null>(null);
  const [highlightSkuId, setHighlightSkuId] = useState<number | null>(
    focusTarget?.skuId ?? null
  );
  const [openBrands, setOpenBrands] = useState<Record<string, boolean>>({});
  const [deleteBrand, setDeleteBrand] = useState<string | null>(null);
  const [editSkuId, setEditSkuId] = useState<number | null>(null);
  const [deleteSkuTarget, setDeleteSkuTarget] = useState<SkuWithDetails | null>(null);
  const [transferSku, setTransferSku] = useState<SkuWithDetails | null>(null);
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
    setHighlightSkuId(focusTarget.skuId ?? null);
    const focusedSku = focusTarget.skuId
      ? skus.find((s) => s.id === focusTarget.skuId)
      : undefined;
    if (focusedSku) {
      setOpenBrands((prev) => ({ ...prev, [focusedSku.brand]: true }));
    }

    const scrollTimer = window.setTimeout(() => {
      if (focusTarget.skuId) {
        rowRefs.current[focusTarget.skuId]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
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
  const filtered = skus.filter((s) => {
    if (!skuPresentInWarehouse(s, effectiveWhId)) return false;
    return skuSearchHaystack(s).includes(q);
  });

  const brandGroups = filtered.reduce<Record<string, SkuWithDetails[]>>((acc, sku) => {
    const brand = sku.brand.trim() || "Unbranded";
    if (!acc[brand]) acc[brand] = [];
    acc[brand].push(sku);
    return acc;
  }, {});

  const brandNames = Object.keys(brandGroups).sort((a, b) => a.localeCompare(b));

  const priceSku = skus.find((s) => s.id === priceSkuId) || null;
  const editSku = skus.find((s) => s.id === editSkuId) || null;

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

  function confirmDeleteSku() {
    if (!deleteSkuTarget) return;
    const target = deleteSkuTarget;
    startTransition(async () => {
      await deleteSku(target.id);
      toast(`Deleted article ${target.brand} ${target.name}`, "info");
      setDeleteSkuTarget(null);
    });
  }

  function confirmDeleteBrand() {
    if (!deleteBrand) return;
    const name = deleteBrand;
    startTransition(async () => {
      const result = await deleteBrandFolder(name);
      toast(`Deleted ${name} (${result.deleted} article${result.deleted === 1 ? "" : "s"})`, "info");
      setDeleteBrand(null);
    });
  }

  const selectedCounts = warehouseStats.find((s) => s.id === effectiveWhId);

  return (
    <div>
      <div className="flex justify-between items-center mb-3.5 gap-2.5 flex-wrap">
        <div className="flex gap-2.5 items-center">
          <select
            className="field min-w-[240px] w-[320px] max-w-full"
            value={effectiveWhId}
            onChange={(e) => setWarehouseId(Number(e.target.value))}
          >
            {warehouses.map((w) => {
              const counts = warehouseStats.find((s) => s.id === w.id);
              return (
                <option key={w.id} value={w.id}>
                  {counts
                    ? `${w.name} · ${warehouseCountLabel(counts.skuCount, counts.pairs)}`
                    : w.name}
                </option>
              );
            })}
          </select>
          <div className="relative shrink-0" style={{ width: 360, maxWidth: "100%" }}>
            <Search
              size={14}
              className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none"
            />
            <input
              className="field field-search"
              style={{ width: "100%" }}
              placeholder="Search brand, article, colour, remarks"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>
        <div className="flex gap-2">
          <button className="btn" onClick={() => setShowImport(true)} disabled={warehouses.length === 0}>
            <FileSpreadsheet size={14} className="inline -mt-0.5" /> Import Excel
          </button>
          <button className="btn btn-primary" onClick={() => setShowAdd(true)}>
            <Plus size={14} className="inline -mt-0.5" /> Add SKU
          </button>
        </div>
      </div>
      <div className="text-xs themed-muted -mt-1 mb-2">
        {selectedCounts
          ? `${warehouseCountLabel(selectedCounts.skuCount, selectedCounts.pairs)} in this godown. `
          : null}
        Cartons = pairs ÷ pairs per carton. A value like 3.8 means the 4th carton is not full.
      </div>

      {brandNames.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-sm themed-muted">
            {q ? "No articles match this search in this godown." : "Nothing listed in this godown yet. Import Excel or add an SKU."}
          </div>
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
                <div className="flex items-center gap-1 pr-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 flex items-center gap-3 px-4 py-3.5 text-left border-none"
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
                  <button
                    type="button"
                    className="btn text-xs px-2.5 py-1.5 shrink-0"
                    title={`Delete ${brand}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteBrand(brand);
                    }}
                    style={{ color: "#E05A5A" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

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
                        <div className="flex-1 min-w-[240px] overflow-x-auto">
                          <table className="w-full text-left">
                            <thead>
                              <tr className="text-[10px] uppercase themed-muted">
                                <th className="font-semibold pb-1 pr-3">Range</th>
                                <th className="font-semibold pb-1 pr-3">Colour</th>
                                <th className="font-semibold pb-1 pr-3">Remarks</th>
                                <th className="font-semibold pb-1 pr-3 text-center">Pairs</th>
                                <th className="font-semibold pb-1 pr-3 text-center" title="3.8 means the 4th carton is not full">
                                  Cartons
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {s.categories
                                .filter((c) => s.stock[effectiveWhId]?.[c.id] !== undefined)
                                .map((c) => {
                                const qty = s.stock[effectiveWhId]?.[c.id] ?? 0;
                                return (
                                  <tr key={c.id}>
                                    <td className="py-1 pr-3 text-sm font-medium themed-title whitespace-nowrap">
                                      {c.label}
                                    </td>
                                    <td className="py-1 pr-3 text-xs themed-muted">{c.colour || "—"}</td>
                                    <td className="py-1 pr-3 text-xs themed-muted">{c.remarks || "—"}</td>
                                    <td className="py-1 pr-3 text-center">
                                      <StockCell
                                        qty={qty}
                                        onSave={(v) => handleAdjust(c.id, v)}
                                      />
                                    </td>
                                    <td className="py-1 pr-3 text-center font-mono text-sm themed-title whitespace-nowrap">
                                      {formatCartons(qty, c.pairsPerCarton)}
                                      {c.pairsPerCarton > 0 && (
                                        <div className="text-[10px] themed-muted font-sans">
                                          {c.pairsPerCarton}/ctn
                                        </div>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                          <button
                            className="btn text-xs px-2.5 py-1"
                            onClick={() => setEditSkuId(s.id)}
                          >
                            <Pencil size={12} className="inline -mt-0.5" /> Edit
                          </button>
                          {warehouses.length > 1 && (
                            <button
                              className="btn text-xs px-2.5 py-1"
                              onClick={() => setTransferSku(s)}
                            >
                              <ArrowLeftRight size={12} className="inline -mt-0.5" /> Transfer
                            </button>
                          )}
                          <button
                            className="btn text-xs px-2.5 py-1"
                            onClick={() => setPriceSkuId(s.id)}
                          >
                            <IndianRupee size={12} className="inline -mt-0.5" /> Prices
                          </button>
                          <button
                            className="btn text-xs px-2.5 py-1"
                            style={{ color: "#E05A5A" }}
                            onClick={() => setDeleteSkuTarget(s)}
                          >
                            <Trash2 size={12} className="inline -mt-0.5" /> Delete
                          </button>
                        </div>
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
      {showImport && (
        <ImportExcelModal
          warehouses={warehouses}
          onClose={() => setShowImport(false)}
        />
      )}
      {priceSku && (
        <EditPricesModal
          sku={priceSku}
          onClose={() => setPriceSkuId(null)}
        />
      )}
      {editSku && (
        <EditSkuModal
          sku={editSku}
          onClose={() => setEditSkuId(null)}
        />
      )}
      {transferSku && (
        <TransferModal
          sku={transferSku}
          warehouses={warehouses}
          fromWarehouseId={effectiveWhId}
          onClose={() => setTransferSku(null)}
        />
      )}
      {deleteSkuTarget && (
        <ConfirmDialog
          danger
          title={`Delete ${deleteSkuTarget.brand} ${deleteSkuTarget.name}?`}
          message="This article is removed from every warehouse. Past bills keep their line items."
          confirmLabel={pending ? "Deleting…" : "Delete article"}
          onConfirm={confirmDeleteSku}
          onCancel={() => setDeleteSkuTarget(null)}
        />
      )}
      {deleteBrand && (
        <ConfirmDialog
          danger
          title={`Delete ${deleteBrand}?`}
          message={`This removes the whole folder and all ${
            skus.filter((s) => (s.brand.trim() || "Unbranded") === deleteBrand).length
          } articles inside it from every warehouse. Past bills keep their line items.`}
          confirmLabel={pending ? "Deleting…" : "Delete folder"}
          onConfirm={confirmDeleteBrand}
          onCancel={() => setDeleteBrand(null)}
        />
      )}
    </div>
  );
}

type SizeDraft = {
  key: number;
  label: string;
  colour: string;
  remarks: string;
  ppc: string;
  A: string;
  B: string;
  C: string;
  D: string;
  qty: string;
};

function defaultSizeRows(): SizeDraft[] {
  return [
    {
      key: 1,
      label: "6-9",
      colour: "",
      remarks: "",
      ppc: "",
      A: "",
      B: "",
      C: "",
      D: "",
      qty: "",
    },
  ];
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
  const nextKey = useRef(2);
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
      { key, label: "", colour: "", remarks: "", ppc: "", A: "", B: "", C: "", D: "", qty: "" },
    ]);
  }

  function removeSize(key: number) {
    setSizes((prev) => prev.filter((s) => s.key !== key));
  }

  function submit() {
    if (!name.trim() || !brand.trim()) return;
    const named = sizes.filter((s) => s.label.trim());
    if (named.length === 0) {
      toast("Add at least one size range");
      return;
    }

    const categories = named.map((s) => ({
      label: formatSizeRange(s.label),
      colour: s.colour.trim(),
      remarks: s.remarks.trim(),
      pairsPerCarton: Number(s.ppc) || 0,
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

      <Label>Size ranges (prices optional)</Label>
      <table className="w-full border-collapse mt-1.5">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Range</th>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Colour</th>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Remarks</th>
            <th className="text-center text-[11px] uppercase themed-muted p-2">Pairs/ctn</th>
            {CUSTOMER_TYPES.map((t) => (
              <th key={t.id} className="text-center text-[11px] uppercase themed-muted p-2">{t.id}</th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {sizes.map((s) => (
            <tr key={s.key}>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={s.label}
                  placeholder="6*9 or 6-9"
                  onChange={(e) => updateSize(s.key, { label: e.target.value })}
                />
              </td>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={s.colour}
                  placeholder="Black"
                  onChange={(e) => updateSize(s.key, { colour: e.target.value })}
                />
              </td>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={s.remarks}
                  placeholder="e.g. HAWAI LOOSE"
                  onChange={(e) => updateSize(s.key, { remarks: e.target.value })}
                />
              </td>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-center font-mono"
                  type="number"
                  step="0.1"
                  value={s.ppc}
                  placeholder="72"
                  onChange={(e) => updateSize(s.key, { ppc: e.target.value })}
                />
              </td>
              {(["A", "B", "C", "D"] as const).map((t) => (
                <td key={t} className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                  <input
                    className="field text-center font-mono"
                    type="number"
                    value={s[t]}
                    onChange={(e) => updateSize(s.key, { [t]: e.target.value })}
                    placeholder="—"
                  />
                </td>
              ))}
              <td className="p-1.5 text-right" style={{ borderBottom: "1px solid var(--border)" }}>
                <button
                  type="button"
                  className="w-8 h-8 rounded-lg border-none flex items-center justify-center"
                  style={{ background: "color-mix(in srgb, #E05A5A 14%, var(--surface))", color: "#E05A5A" }}
                  title="Remove size range"
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
        <Plus size={13} className="inline -mt-0.5" /> Add size range
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
                {[s.label.trim() || "Untitled", s.colour.trim()].filter(Boolean).join(" · ")}
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
    const map: Record<number, { A: string; B: string; C: string; D: string; ppc: string }> = {};
    sku.categories.forEach((c) => {
      map[c.id] = {
        A: c.prices.A ? String(c.prices.A) : "",
        B: c.prices.B ? String(c.prices.B) : "",
        C: c.prices.C ? String(c.prices.C) : "",
        D: c.prices.D ? String(c.prices.D) : "",
        ppc: c.pairsPerCarton ? String(c.pairsPerCarton) : "",
      };
    });
    return map;
  });
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit() {
    const cleaned: Record<number, { A: number; B: number; C: number; D: number; pairsPerCarton: number }> = {};
    sku.categories.forEach((c) => {
      cleaned[c.id] = {
        A: Number(prices[c.id].A) || 0,
        B: Number(prices[c.id].B) || 0,
        C: Number(prices[c.id].C) || 0,
        D: Number(prices[c.id].D) || 0,
        pairsPerCarton: Number(prices[c.id].ppc) || 0,
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
      <Label>Price per size range × customer type (₹) — optional</Label>
      <table className="w-full border-collapse mt-1.5">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Range</th>
            <th className="text-center text-[11px] uppercase themed-muted p-2">Pairs/ctn</th>
            {CUSTOMER_TYPES.map((t) => (
              <th key={t.id} className="text-center text-[11px] uppercase themed-muted p-2">{t.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sku.categories.map((c) => (
            <tr key={c.id}>
              <td className="p-2 text-sm font-semibold" style={{ borderBottom: "1px solid var(--border)" }}>
                {c.label}
                {c.colour ? ` · ${c.colour}` : ""}
                {c.remarks ? ` · ${c.remarks}` : ""}
              </td>
              <td className="p-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-center font-mono"
                  type="number"
                  step="0.1"
                  placeholder="—"
                  value={prices[c.id].ppc}
                  onChange={(e) =>
                    setPrices((prev) => ({
                      ...prev,
                      [c.id]: { ...prev[c.id], ppc: e.target.value },
                    }))
                  }
                />
              </td>
              {(["A", "B", "C", "D"] as const).map((t) => (
                <td key={t} className="p-2 border-b border-stone-100">
                  <input
                    className="field text-center font-mono"
                    type="number"
                    placeholder="—"
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
        Prices are optional. Leave blank and set them later or enter a price on the bill. Cartons use pairs ÷ pairs/carton (3.8 means the 4th carton is not full).
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending}>Save prices</button>
      </div>
    </ModalShell>
  );
}

function ImportExcelModal({
  warehouses,
  onClose,
}: {
  warehouses: Warehouse[];
  onClose: () => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id);
  const [rows, setRows] = useState<Awaited<ReturnType<typeof parseInventoryWorkbook>>>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  async function onFile(file: File | undefined) {
    setError("");
    setRows([]);
    setFileName(file?.name || "");
    if (!file) return;
    const buf = await file.arrayBuffer();
    const parsed = parseInventoryWorkbook(buf);
    if (parsed.length === 0) {
      setError("Could not find Company, Article, Size and Stocks columns in the first sheet.");
      return;
    }
    setRows(parsed);
  }

  function submit() {
    if (!warehouseId || rows.length === 0) return;
    startTransition(async () => {
      const result = await importInventoryRows(warehouseId, rows);
      toast(`Imported ${result.created} new rows, updated ${result.updated}.`);
      onClose();
    });
  }

  return (
    <ModalShell title="Import Excel stock" onClose={onClose} wide>
      <p className="text-sm themed-muted mb-3">
        Use a godown sheet with Company, Article, Size, Stocks, Colour, Remarks, and pairs per carton.
        Size like 6*9 is stored as 6-9. Prices are not required.
      </p>
      <Label>Warehouse for this sheet</Label>
      <select
        className="field mb-3"
        value={warehouseId}
        onChange={(e) => setWarehouseId(Number(e.target.value))}
      >
        {warehouses.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </select>
      <Label>Excel file</Label>
      <input
        className="field"
        type="file"
        accept=".xlsx,.xls"
        onChange={(e) => onFile(e.target.files?.[0])}
      />
      {error && <div className="text-sm text-red-500 mt-2">{error}</div>}
      {rows.length > 0 && (
        <div className="mt-3 text-sm themed-title">
          {fileName}: {rows.length} row{rows.length === 1 ? "" : "s"} ready
          <div className="max-h-[220px] overflow-auto mt-2 rounded-lg border" style={{ borderColor: "var(--border)" }}>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="themed-muted uppercase">
                  <th className="p-2">Company</th>
                  <th className="p-2">Article</th>
                  <th className="p-2">Range</th>
                  <th className="p-2">Colour</th>
                  <th className="p-2">Remarks</th>
                  <th className="p-2">Pairs</th>
                  <th className="p-2">PPC</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 40).map((r, i) => (
                  <tr key={i}>
                    <td className="p-2">{r.brand}</td>
                    <td className="p-2">{r.name}</td>
                    <td className="p-2">{r.size}</td>
                    <td className="p-2">{r.colour || "—"}</td>
                    <td className="p-2">{r.remarks || "—"}</td>
                    <td className="p-2 font-mono">{r.qty}</td>
                    <td className="p-2 font-mono">{r.pairsPerCarton || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 40 && (
            <div className="text-xs themed-muted mt-1">Showing first 40 of {rows.length}.</div>
          )}
        </div>
      )}
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending || rows.length === 0}>
          Import into stock
        </button>
      </div>
    </ModalShell>
  );
}

function EditSkuModal({
  sku,
  onClose,
}: {
  sku: SkuWithDetails;
  onClose: () => void;
}) {
  const [name, setName] = useState(sku.name);
  const [brand, setBrand] = useState(sku.brand);
  const [cats, setCats] = useState(() =>
    sku.categories.map((c) => ({
      id: c.id,
      label: c.label,
      colour: c.colour,
      remarks: c.remarks,
    }))
  );
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit() {
    if (!name.trim() || !brand.trim()) {
      toast("Company and article are required", "error");
      return;
    }
    startTransition(async () => {
      try {
        await updateSkuDetails({ id: sku.id, name, brand, categories: cats });
        toast("Article updated");
        onClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not update article.", "error");
      }
    });
  }

  return (
    <ModalShell title="Edit article" onClose={onClose} wide>
      <div className="flex gap-2.5 mb-3">
        <div className="flex-1">
          <Label>Article</Label>
          <input className="field" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="flex-1">
          <Label>Company</Label>
          <input className="field" value={brand} onChange={(e) => setBrand(e.target.value)} />
        </div>
      </div>
      <Label>Size ranges</Label>
      <table className="w-full border-collapse mt-1.5">
        <thead>
          <tr>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Range</th>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Colour</th>
            <th className="text-left text-[11px] uppercase themed-muted p-2">Remarks</th>
          </tr>
        </thead>
        <tbody>
          {cats.map((c) => (
            <tr key={c.id}>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={c.label}
                  onChange={(e) =>
                    setCats((prev) => prev.map((row) => (row.id === c.id ? { ...row, label: e.target.value } : row)))
                  }
                />
              </td>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={c.colour}
                  onChange={(e) =>
                    setCats((prev) => prev.map((row) => (row.id === c.id ? { ...row, colour: e.target.value } : row)))
                  }
                />
              </td>
              <td className="p-1.5" style={{ borderBottom: "1px solid var(--border)" }}>
                <input
                  className="field text-sm"
                  value={c.remarks}
                  onChange={(e) =>
                    setCats((prev) => prev.map((row) => (row.id === c.id ? { ...row, remarks: e.target.value } : row)))
                  }
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending}>Save article</button>
      </div>
    </ModalShell>
  );
}

function TransferModal({
  sku,
  warehouses,
  fromWarehouseId,
  onClose,
}: {
  sku: SkuWithDetails;
  warehouses: Warehouse[];
  fromWarehouseId: number;
  onClose: () => void;
}) {
  const [fromId, setFromId] = useState(fromWarehouseId);
  const [toId, setToId] = useState(
    warehouses.find((w) => w.id !== fromWarehouseId)?.id ?? warehouses[0]?.id
  );
  const [qtys, setQtys] = useState<Record<number, string>>({});
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  function submit() {
    const moves = sku.categories
      .map((c) => ({ skuCategoryId: c.id, qty: Number(qtys[c.id]) || 0 }))
      .filter((m) => m.qty > 0);
    if (moves.length === 0) {
      toast("Enter pairs to move", "error");
      return;
    }
    startTransition(async () => {
      try {
        await transferStock(fromId, toId, moves);
        toast("Stock transferred");
        onClose();
      } catch (err) {
        toast(err instanceof Error ? err.message : "Could not transfer stock.", "error");
      }
    });
  }

  return (
    <ModalShell title={`Transfer ${sku.brand} ${sku.name}`} onClose={onClose} wide>
      <div className="flex gap-2.5 mb-3">
        <div className="flex-1">
          <Label>From</Label>
          <select className="field" value={fromId} onChange={(e) => setFromId(Number(e.target.value))}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <Label>To</Label>
          <select className="field" value={toId} onChange={(e) => setToId(Number(e.target.value))}>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>{w.name}</option>
            ))}
          </select>
        </div>
      </div>
      <Label>Pairs to move</Label>
      <div className="grid grid-cols-2 gap-2 mt-1.5">
        {sku.categories
          .filter((c) => sku.stock[fromId]?.[c.id] !== undefined)
          .map((c) => {
          const avail = sku.stock[fromId]?.[c.id] ?? 0;
          return (
            <div key={c.id}>
              <div className="text-xs themed-muted mb-1">
                {[c.label, c.colour].filter(Boolean).join(" · ")} · {avail} here
              </div>
              <input
                className="field font-mono text-center"
                type="number"
                min={0}
                max={avail}
                placeholder="0"
                value={qtys[c.id] || ""}
                onChange={(e) => setQtys((p) => ({ ...p, [c.id]: e.target.value }))}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn btn-primary" onClick={submit} disabled={pending}>Transfer</button>
      </div>
    </ModalShell>
  );
}
