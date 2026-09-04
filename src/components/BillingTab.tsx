"use client";

import { useState, useEffect, useTransition } from "react";
import { Search, Plus, Trash2, Printer, ShoppingCart } from "lucide-react";
import { Card, StitchDivider, Label } from "./ui/Card";
import { Tag } from "./ui/Tag";
import { CUSTOMER_TYPES, inr } from "@/lib/constants";
import { addCustomer, createBill, type BillInput, type SkuWithDetails } from "@/lib/actions";
import { useToast } from "./ui/Toast";

type Warehouse = { id: number; name: string };
type Customer = { id: number; name: string; type: string; creditBalance: number };

type CartItem = {
  skuCategoryId: number;
  skuName: string;
  brand: string;
  categoryLabel: string;
  qty: number;
  price: number;
  subtotal: number;
};

export default function BillingTab({
  skus,
  warehouses,
  customers,
  onBillCreated,
}: {
  skus: SkuWithDetails[];
  warehouses: Warehouse[];
  customers: Customer[];
  onBillCreated: (bill: any) => void;
}) {
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id);
  const [customerId, setCustomerId] = useState<number | "">("");
  const [customerType, setCustomerType] = useState("A");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [productQuery, setProductQuery] = useState("");
  const [productOpen, setProductOpen] = useState(false);
  const [activeSku, setActiveSku] = useState<SkuWithDetails | null>(null);
  const [catQty, setCatQty] = useState<Record<number, string>>({});
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cash, setCash] = useState("");
  const [online, setOnline] = useState("");
  const [discount, setDiscount] = useState("");
  const [claim, setClaim] = useState("");
  const [billType, setBillType] = useState("A");
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const effectiveWhId = warehouses.some((w) => w.id === warehouseId) ? warehouseId : warehouses[0]?.id;
  const customer = customers.find((c) => c.id === customerId);
  const availableAdvance = customer && customer.creditBalance < 0 ? -customer.creditBalance : 0;

  useEffect(() => {
    if (customer) setBillType(customer.type);
  }, [customerId]);

  const filteredSkus = productQuery.length > 0
    ? skus.filter((s) => (s.brand + " " + s.name).toLowerCase().includes(productQuery.toLowerCase()))
    : skus;

  function cartQtyFor(skuCatId: number) {
    return cart.filter((it) => it.skuCategoryId === skuCatId).reduce((a, it) => a + it.qty, 0);
  }

  function addToCart(sku: SkuWithDetails, cat: SkuWithDetails["categories"][0]) {
    const qty = Number(catQty[cat.id]) || 0;
    if (qty <= 0) return;
    const stockAvail = sku.stock[effectiveWhId]?.[cat.id] ?? 0;
    const alreadyIn = cartQtyFor(cat.id);
    const finalQty = Math.min(qty, Math.max(stockAvail - alreadyIn, 0));
    if (finalQty <= 0) return;
    const price = cat.prices[billType as keyof typeof cat.prices];
    setCart((prev) => [
      ...prev,
      {
        skuCategoryId: cat.id,
        skuName: sku.name,
        brand: sku.brand,
        categoryLabel: cat.label,
        qty: finalQty,
        price,
        subtotal: finalQty * price,
      },
    ]);
    setCatQty((prev) => ({ ...prev, [cat.id]: "" }));
  }

  const subtotal = cart.reduce((a, it) => a + it.subtotal, 0);
  const discountN = Number(discount) || 0;
  const claimN = Number(claim) || 0;
  const total = Math.max(subtotal - discountN - claimN, 0);
  const cashN = Number(cash) || 0;
  const onlineN = Number(online) || 0;
  const balance = total - cashN - onlineN;

  function handleAddCustomer() {
    if (!newCustomerName.trim()) return;
    startTransition(async () => {
      const c = await addCustomer(newCustomerName.trim(), customerType);
      toast(`Customer "${newCustomerName.trim()}" added`);
      setCustomerId(c.id);
      setShowNewCustomer(false);
      setNewCustomerName("");
    });
  }

  function submitBill() {
    if (!customer || cart.length === 0) return;
    const wh = warehouses.find((w) => w.id === effectiveWhId);
    const input: BillInput = {
      customerId: customer.id,
      customerName: customer.name,
      customerType: billType,
      warehouseId: effectiveWhId,
      warehouseName: wh?.name || "",
      items: cart,
      subtotal,
      discount: discountN,
      claim: claimN,
      total,
      paidCash: cashN,
      paidOnline: onlineN,
      balance,
    };
    startTransition(async () => {
      const bill = await createBill(input);
      onBillCreated(bill);
      setCart([]);
      setCash("");
      setOnline("");
      setDiscount("");
      setClaim("");
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-4">
      {/* Left — product selection */}
      <div>
        <Card>
          <Label>Warehouse</Label>
          <select className="field" value={effectiveWhId} onChange={(e) => setWarehouseId(Number(e.target.value))}>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>

          <div className="mt-3.5">
            <Label>Customer</Label>
            {!showNewCustomer ? (
              <div className="flex gap-2">
                <select className="field" value={customerId} onChange={(e) => setCustomerId(e.target.value ? Number(e.target.value) : "")}>
                  <option value="">Select customer…</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name} ({c.type})</option>)}
                </select>
                <button className="btn" onClick={() => setShowNewCustomer(true)}>+ New</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input className="field" placeholder="Customer name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} />
                <select className="field w-[90px]" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
                  {CUSTOMER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
                </select>
                <button className="btn btn-primary" onClick={handleAddCustomer}>Save</button>
              </div>
            )}
            {customer && (
              <div className="mt-2 flex items-center gap-2">
                {customer.creditBalance > 0 && <Tag tone="amber">Existing credit {inr(customer.creditBalance)}</Tag>}
                {customer.creditBalance < 0 && <Tag tone="green">Advance {inr(-customer.creditBalance)}</Tag>}
              </div>
            )}
          </div>

          <div className="mt-3.5">
            <Label>Billing type (sets pricing for this bill)</Label>
            <select className="field" value={billType} onChange={(e) => setBillType(e.target.value)}>
              {CUSTOMER_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
            </select>
            {customer && billType !== customer.type && (
              <div className="text-[11.5px] text-amber-600 mt-1">
                Different from {customer.name}&apos;s usual type ({customer.type}) — prices below use {billType} for this bill only.
              </div>
            )}
          </div>

          <div className="mt-3.5 relative">
            <Label>Search product</Label>
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none" />
              <input
                className="field field-search"
                placeholder="Type SKU or brand name…"
                value={productQuery}
                onFocus={() => setProductOpen(true)}
                onChange={(e) => { setProductQuery(e.target.value); setProductOpen(true); }}
              />
            </div>
            {productOpen && (
              <div className="absolute z-10 top-full left-0 right-0 themed-card border rounded-lg mt-1 max-h-[220px] overflow-y-auto shadow-lg">
                {filteredSkus.length === 0 && <div className="p-2.5 text-sm themed-muted">No matches.</div>}
                {filteredSkus.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => { setActiveSku(s); setProductOpen(false); setProductQuery(""); }}
                    className="p-2 px-3 text-sm cursor-pointer themed-title"
                    style={{ borderBottom: "1px solid var(--border)", background: "transparent" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "var(--surface-soft)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                  >
                    <b>{s.name}</b> <span className="themed-muted">· {s.brand}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {activeSku && (
            <div className="mt-3.5 rounded-lg p-3" style={{ border: "1px dashed var(--border-strong)" }}>
              <div className="font-semibold mb-2 themed-title">
                {activeSku.brand} {activeSku.name}{" "}
                <span className="text-[11px] themed-muted font-mono">· pricing for {billType}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {activeSku.categories.map((c) => {
                  const avail = (activeSku.stock[effectiveWhId]?.[c.id] ?? 0) - cartQtyFor(c.id);
                  return (
                    <div
                      key={c.id}
                      className={`rounded-md p-2 ${avail <= 0 ? "opacity-50" : ""}`}
                      style={{ border: "1px solid var(--border-strong)" }}
                    >
                      <div className="text-xs font-semibold themed-title">{c.label}</div>
                      <div className="text-xs themed-muted font-mono">
                        {inr(c.prices[billType as keyof typeof c.prices])} · {avail} in stock
                      </div>
                      <div className="flex gap-1.5 mt-1.5">
                        <input
                          className="field text-sm p-1"
                          type="number"
                          placeholder="qty"
                          disabled={avail <= 0}
                          value={catQty[c.id] || ""}
                          onChange={(e) => setCatQty((p) => ({ ...p, [c.id]: e.target.value }))}
                        />
                        <button className="btn" disabled={avail <= 0} onClick={() => addToCart(activeSku, c)}>
                          <Plus size={13} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </Card>
      </div>

      {/* Right — cart & totals */}
      <div>
        <Card>
          <div className="font-display font-semibold text-[15px] flex items-center gap-2 themed-title">
            Bill cart
            {cart.length > 0 && (
              <span
                className="text-[11px] font-bold px-2.5 py-0.5 rounded-full"
                style={{ background: "var(--color-brand-soft)", color: "var(--accent)" }}
              >
                {cart.length} item{cart.length !== 1 ? "s" : ""} · {cart.reduce((a, it) => a + it.qty, 0)} pairs
              </span>
            )}
          </div>
          <StitchDivider />
          {cart.length === 0 ? (
            <div className="text-center py-6">
              <ShoppingCart size={28} className="mx-auto themed-muted mb-2" />
              <div className="text-sm themed-muted">Cart is empty</div>
              <div className="text-xs themed-muted mt-1">Search a product on the left and add sizes to build the bill</div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {cart.map((it, i) => (
                <div key={i} className="flex justify-between items-center text-sm">
                  <div>
                    <div className="font-semibold themed-title">
                      {it.brand} {it.skuName}{" "}
                      <span className="themed-muted font-normal">· {it.categoryLabel}</span>
                    </div>
                    <div className="text-[11.5px] themed-muted font-mono">
                      {it.qty} × {inr(it.price)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold themed-title">{inr(it.subtotal)}</span>
                    <button onClick={() => setCart((prev) => prev.filter((_, j) => j !== i))} className="text-red-500 bg-transparent border-none">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <StitchDivider />

          <div className="flex gap-2.5 mb-2.5">
            <div className="flex-1">
              <Label>Discount (₹)</Label>
              <input className="field font-mono" type="number" value={discount} onChange={(e) => setDiscount(e.target.value)} placeholder="0" />
            </div>
            <div className="flex-1">
              <Label>Claim (₹)</Label>
              <input className="field font-mono" type="number" value={claim} onChange={(e) => setClaim(e.target.value)} placeholder="0" />
            </div>
          </div>

          {customer && (
            <div className="text-[11.5px] themed-muted -mt-1 mb-2.5">
              {availableAdvance > 0 ? (
                <>Claim deducts from {customer.name}&apos;s existing advance of <b className="font-mono">{inr(availableAdvance)}</b>.</>
              ) : (
                "Claim deducts an amount the customer previously overpaid from this bill."
              )}
              {claimN > availableAdvance && <span className="text-red-500"> Entered claim exceeds available advance.</span>}
            </div>
          )}

          <div className="flex flex-col gap-1 text-sm mb-2.5">
            <div className="flex justify-between themed-muted">
              <span>Subtotal</span><span className="font-mono">{inr(subtotal)}</span>
            </div>
            {discountN > 0 && (
              <div className="flex justify-between themed-muted">
                <span>Discount</span><span className="font-mono">−{inr(discountN)}</span>
              </div>
            )}
            {claimN > 0 && (
              <div className="flex justify-between themed-muted">
                <span>Claim applied</span><span className="font-mono">−{inr(claimN)}</span>
              </div>
            )}
          </div>

          <div className="flex justify-between text-base font-bold mb-3 themed-title">
            <span>Total payable</span><span className="font-mono">{inr(total)}</span>
          </div>

          <Label>Paid in cash (₹)</Label>
          <input className="field font-mono mb-2.5" type="number" value={cash} onChange={(e) => setCash(e.target.value)} placeholder="0" />
          <Label>Paid online (₹)</Label>
          <input className="field font-mono" type="number" value={online} onChange={(e) => setOnline(e.target.value)} placeholder="0" />

          <div
            className="mt-3 p-2.5 rounded-md text-sm themed-title"
            style={{
              background:
                balance > 0
                  ? "color-mix(in srgb, #E07A3A 16%, var(--surface))"
                  : balance < 0
                    ? "color-mix(in srgb, #1F9B5A 16%, var(--surface))"
                    : "var(--surface-soft)",
            }}
          >
            {balance > 0 && <span>Balance due — <b className="font-mono">{inr(balance)}</b> will be added to this customer&apos;s credit.</span>}
            {balance < 0 && <span>Overpaid by <b className="font-mono">{inr(-balance)}</b> — will reduce existing credit.</span>}
            {balance === 0 && <span>Fully paid — no credit change.</span>}
          </div>

          <button
            className="btn btn-primary w-full mt-3.5 py-2.5"
            disabled={!customer || cart.length === 0 || pending}
            onClick={submitBill}
          >
            Complete bill & generate print copy
          </button>
        </Card>
      </div>
    </div>
  );
}
