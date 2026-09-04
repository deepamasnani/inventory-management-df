"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Package,
  Users,
  Warehouse as WarehouseIcon,
  LayoutDashboard,
  ShoppingCart,
  FileText,
  Search,
  Bell,
  Settings,
  Moon,
  Sun,
  AlertTriangle,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { inr } from "@/lib/constants";
import Overview from "./Overview";
import InventoryTab, { type InventoryFocus } from "./InventoryTab";
import BillingTab from "./BillingTab";
import BillsTab from "./BillsTab";
import CustomersTab from "./CustomersTab";
import PrintModal from "./PrintModal";
import WarehouseModal from "./WarehouseModal";
import { ToastProvider, useToast } from "./ui/Toast";
import type { SkuWithDetails } from "@/lib/actions";

type Warehouse = { id: number; name: string; createdAt: Date | null };
type Customer = { id: number; name: string; type: string; creditBalance: number };
type Bill = {
  id: number;
  invoiceNo: string;
  date: string;
  customerId: number;
  customerName: string;
  customerType: string;
  warehouseId: number;
  warehouseName: string;
  subtotal: number;
  discount: number;
  claim: number;
  total: number;
  paidCash: number;
  paidOnline: number;
  balance: number;
};

type DashboardStats = {
  totalSkus: number;
  totalPairs: number;
  inventoryValue: number;
  outstandingCredit: number;
  revenueCollected: number;
  lowStock: {
    skuId: number;
    warehouseId: number;
    sku: string;
    brand: string;
    warehouse: string;
    category: string;
    qty: number;
  }[];
  recentBills: Bill[];
};

const navItems = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard, shortcut: "1" },
  { id: "inventory", label: "Inventory", icon: Package, shortcut: "2" },
  { id: "billing", label: "New Bill", icon: ShoppingCart, shortcut: "3" },
  { id: "bills", label: "Bills", icon: FileText, shortcut: "4" },
  { id: "customers", label: "Customers", icon: Users, shortcut: "5" },
] as const;

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function AppShellInner({
  initialTab,
  stats,
  warehouses,
  skus,
  customers,
  bills,
}: {
  initialTab: string;
  stats: DashboardStats;
  warehouses: Warehouse[];
  skus: SkuWithDetails[];
  customers: Customer[];
  bills: Bill[];
}) {
  const [tab, setTab] = useState<string>(initialTab);
  const [printBill, setPrintBill] = useState<any>(null);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [inventoryQuery, setInventoryQuery] = useState("");
  const [billsQuery, setBillsQuery] = useState("");
  const [customersQuery, setCustomersQuery] = useState("");
  const [openBillId, setOpenBillId] = useState<number | null>(null);
  const [openCustomerId, setOpenCustomerId] = useState<number | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [inventoryFocus, setInventoryFocus] = useState<InventoryFocus | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  const creditCustomers = customers.filter((c) => c.creditBalance > 0);
  const notificationCount = stats.lowStock.length + creditCustomers.length;
  const q = search.trim().toLowerCase();

  const searchHits = useMemo(() => {
    if (q.length < 1) {
      return { skus: [] as SkuWithDetails[], bills: [] as Bill[], customers: [] as Customer[] };
    }
    return {
      skus: skus.filter((s) => `${s.brand} ${s.name}`.toLowerCase().includes(q)).slice(0, 5),
      bills: bills
        .filter((b) =>
          `${b.invoiceNo} ${b.customerName} ${b.warehouseName}`.toLowerCase().includes(q)
        )
        .slice(0, 5),
      customers: customers
        .filter((c) => `${c.name} ${c.type}`.toLowerCase().includes(q))
        .slice(0, 5),
    };
  }, [q, skus, bills, customers]);

  const searchCount =
    searchHits.skus.length + searchHits.bills.length + searchHits.customers.length;

  useEffect(() => {
    const saved = window.localStorage.getItem("dev-footwear-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    setDarkMode(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLSelectElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;

      if (e.altKey && e.key >= "1" && e.key <= "5") {
        e.preventDefault();
        const idx = parseInt(e.key) - 1;
        if (navItems[idx]) {
          go(navItems[idx].id);
        }
      }

      if (e.altKey && e.key === "w") {
        e.preventDefault();
        setShowWarehouseModal(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [router]);

  function handleBillCreated(bill: any) {
    setPrintBill(bill);
    toast(`Bill ${bill.invoiceNo} created successfully!`);
    router.refresh();
  }

  function go(id: string, focus?: Omit<InventoryFocus, "key">) {
    if (id === "inventory" && focus) {
      setInventoryFocus({ ...focus, key: Date.now() });
    } else if (id !== "inventory") {
      setInventoryFocus(null);
    }
    if (id !== "bills") setOpenBillId(null);
    if (id !== "customers") setOpenCustomerId(null);
    setShowSearch(false);
    setTab(id);
    const url = id === "overview" ? "/" : `/?tab=${id}`;
    router.replace(url, { scroll: false });
  }

  function applyGlobalSearch() {
    const term = search.trim();
    if (!term) return;
    if (searchHits.skus.length && !searchHits.bills.length && !searchHits.customers.length) {
      setInventoryQuery(term);
      go("inventory");
      return;
    }
    if (searchHits.bills.length && !searchHits.skus.length && !searchHits.customers.length) {
      setBillsQuery(term);
      go("bills");
      return;
    }
    if (searchHits.customers.length && !searchHits.skus.length && !searchHits.bills.length) {
      setCustomersQuery(term);
      go("customers");
      return;
    }
    setShowSearch(true);
  }

  function openLowStockItem(item: {
    skuId: number;
    warehouseId: number;
  }) {
    setShowNotifications(false);
    go("inventory", {
      skuId: item.skuId,
      warehouseId: item.warehouseId,
    });
  }

  function toggleTheme() {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("dev-footwear-theme", next ? "dark" : "light");
  }

  return (
    <div className="min-h-screen p-4 md:p-6 lg:p-8">
      <div
        className="no-print max-w-[1440px] mx-auto rounded-[28px] overflow-hidden flex min-h-[calc(100vh-4rem)]"
        style={{ background: "var(--app-shell-bg)", boxShadow: "var(--app-shell-shadow)" }}
      >
        {/* Sidebar */}
        <aside className="w-[230px] shrink-0 flex flex-col" style={{ background: "var(--sidebar-bg)", borderRight: "1px solid var(--border)" }}>
          <div className="px-5 py-6 flex items-center gap-2.5">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center"
              style={{
                background: "linear-gradient(145deg, #0F766E 0%, #14B8A6 100%)",
                boxShadow: "0 3px 10px rgba(15, 118, 110, 0.3)",
              }}
            >
              <span className="text-[#ecfdf8] font-bold text-sm">D</span>
            </div>
            <div>
              <div className="font-bold text-[15px] tracking-tight themed-title">Dev Footwear</div>
              <div className="text-[10px] font-medium themed-muted">Inventory & Billing</div>
            </div>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => go(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left border-none transition-all duration-150 ${
                    active
                      ? "font-semibold shadow-[0_2px_8px_rgba(108,99,255,0.1)]"
                      : "bg-transparent themed-muted"
                  }`}
                  style={
                    active
                      ? { background: "var(--color-brand-soft)", color: "var(--accent)" }
                      : undefined
                  }
                >
                  <Icon size={17} />
                  <span className="flex-1 text-[13px]">{item.label}</span>
                  <span className="kbd">{item.shortcut}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3" style={{ borderTop: "1px solid var(--border)" }}>
            <button
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-transparent border-none transition-colors themed-muted"
              style={{}}
              onClick={() => setShowWarehouseModal(true)}
            >
              <WarehouseIcon size={17} />
              <span className="text-[13px]">
                {warehouses.length} warehouse{warehouses.length !== 1 ? "s" : ""}
              </span>
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0" style={{ background: "var(--main-bg)" }}>
          {/* Top bar */}
          <header className="px-6 lg:px-8 py-4 flex items-center justify-between gap-4 backdrop-blur-sm" style={{ borderBottom: "1px solid var(--border)", background: "var(--header-bg)" }}>
            <div className="relative flex-1 max-w-md">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none z-10" />
              <input
                className="field field-search border-transparent rounded-full"
                style={{ background: "var(--surface-soft)" }}
                placeholder="Search inventory, bills, customers…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setShowSearch(true);
                }}
                onFocus={() => search.trim() && setShowSearch(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && search.trim()) {
                    applyGlobalSearch();
                  }
                  if (e.key === "Escape") setShowSearch(false);
                }}
              />
              {showSearch && q && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowSearch(false)} />
                  <div
                    className="absolute left-0 right-0 top-12 z-50 rounded-2xl border overflow-hidden animate-scale-in"
                    style={{
                      background: "var(--surface)",
                      borderColor: "var(--border)",
                      boxShadow: "var(--app-shell-shadow)",
                    }}
                  >
                    {searchCount === 0 ? (
                      <div className="px-4 py-6 text-center text-sm themed-muted">
                        No matches for “{search.trim()}”
                      </div>
                    ) : (
                      <div className="max-h-[380px] overflow-y-auto py-1">
                        {searchHits.skus.length > 0 && (
                          <div>
                            <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide themed-muted font-semibold">
                              Inventory
                            </div>
                            {searchHits.skus.map((s) => (
                              <button
                                key={`sku-${s.id}`}
                                className="w-full text-left px-4 py-2.5 bg-transparent border-none hover:opacity-90"
                                style={{ borderBottom: "1px solid var(--border)" }}
                                onClick={() => {
                                  setInventoryQuery("");
                                  go("inventory", {
                                    skuId: s.id,
                                    warehouseId: warehouses[0]?.id ?? 0,
                                  });
                                  setSearch("");
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Package size={14} style={{ color: "var(--accent)" }} />
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold themed-title truncate">
                                      {s.brand} {s.name}
                                    </div>
                                    <div className="text-[11px] themed-muted">Article</div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchHits.bills.length > 0 && (
                          <div>
                            <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide themed-muted font-semibold">
                              Bills
                            </div>
                            {searchHits.bills.map((b) => (
                              <button
                                key={`bill-${b.id}`}
                                className="w-full text-left px-4 py-2.5 bg-transparent border-none hover:opacity-90"
                                style={{ borderBottom: "1px solid var(--border)" }}
                                onClick={() => {
                                  setBillsQuery("");
                                  setOpenBillId(b.id);
                                  go("bills");
                                  setSearch("");
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <FileText size={14} style={{ color: "var(--accent)" }} />
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold themed-title truncate">
                                      {b.invoiceNo} · {b.customerName}
                                    </div>
                                    <div className="text-[11px] themed-muted">
                                      {b.date} · {inr(b.total)}
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                        {searchHits.customers.length > 0 && (
                          <div>
                            <div className="px-4 pt-2 pb-1 text-[10px] uppercase tracking-wide themed-muted font-semibold">
                              Customers
                            </div>
                            {searchHits.customers.map((c) => (
                              <button
                                key={`cust-${c.id}`}
                                className="w-full text-left px-4 py-2.5 bg-transparent border-none hover:opacity-90"
                                style={{ borderBottom: "1px solid var(--border)" }}
                                onClick={() => {
                                  setCustomersQuery("");
                                  setOpenCustomerId(c.id);
                                  go("customers");
                                  setSearch("");
                                }}
                              >
                                <div className="flex items-center gap-2.5">
                                  <Users size={14} style={{ color: "var(--accent)" }} />
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold themed-title truncate">
                                      {c.name}
                                    </div>
                                    <div className="text-[11px] themed-muted">
                                      Type {c.type} · {inr(c.creditBalance)} credit
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                className="w-10 h-10 rounded-full border-none flex items-center justify-center transition-colors"
                style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
                onClick={toggleTheme}
                title={darkMode ? "Switch to light mode" : "Switch to dark mode"}
              >
                {darkMode ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button
                className="w-10 h-10 rounded-full border-none flex items-center justify-center transition-colors"
                style={{ background: "var(--surface-soft)", color: "var(--text-muted)" }}
                onClick={() => setShowWarehouseModal(true)}
                title="Settings / warehouses"
              >
                <Settings size={16} />
              </button>
              <div className="relative">
                <button
                  className="w-10 h-10 rounded-full border-none flex items-center justify-center transition-colors relative"
                  style={{
                    background: showNotifications ? "var(--color-brand-soft)" : "var(--surface-soft)",
                    color: showNotifications ? "var(--accent)" : "var(--text-muted)",
                  }}
                  onClick={() => setShowNotifications((v) => !v)}
                  title="Notifications"
                >
                  <Bell size={16} />
                  {notificationCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-[#FF6B6B] text-white text-[10px] font-bold flex items-center justify-center">
                      {notificationCount > 9 ? "9+" : notificationCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowNotifications(false)}
                    />
                    <div
                      className="absolute right-0 top-12 z-50 w-[340px] rounded-2xl border shadow-2xl animate-scale-in overflow-hidden"
                      style={{
                        background: "var(--surface)",
                        borderColor: "var(--border)",
                        boxShadow: "var(--app-shell-shadow)",
                      }}
                    >
                      <div
                        className="px-4 py-3 flex items-center justify-between"
                        style={{ borderBottom: "1px solid var(--border)" }}
                      >
                        <div className="font-semibold text-sm themed-title">Notifications</div>
                        <span className="text-[11px] themed-muted">
                          {notificationCount === 0 ? "All clear" : `${notificationCount} alerts`}
                        </span>
                      </div>

                      <div className="max-h-[360px] overflow-y-auto">
                        {notificationCount === 0 ? (
                          <div className="px-4 py-8 text-center">
                            <CheckCircle2 size={28} className="mx-auto mb-2 text-[#3DC97A]" />
                            <div className="text-sm themed-title font-medium">You're all caught up</div>
                            <div className="text-xs themed-muted mt-1">No stock or credit alerts right now</div>
                          </div>
                        ) : (
                          <div className="py-1">
                            {stats.lowStock.slice(0, 6).map((item, i) => (
                              <button
                                key={`stock-${i}`}
                                className="w-full text-left px-4 py-3 bg-transparent border-none hover:opacity-90 transition-colors"
                                style={{ borderBottom: "1px solid var(--border)" }}
                                onClick={() => openLowStockItem(item)}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ background: "color-mix(in srgb, #E05A5A 16%, var(--surface))" }}
                                  >
                                    <AlertTriangle size={14} className="text-[#E05A5A]" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold themed-title truncate">
                                      Low stock · {item.brand} {item.sku}
                                    </div>
                                    <div className="text-[11px] themed-muted mt-0.5">
                                      {item.category} at {item.warehouse} — only {item.qty} pairs left
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}

                            {creditCustomers.slice(0, 5).map((c) => (
                              <button
                                key={`credit-${c.id}`}
                                className="w-full text-left px-4 py-3 bg-transparent border-none hover:opacity-90 transition-colors"
                                style={{ borderBottom: "1px solid var(--border)" }}
                                onClick={() => {
                                  setShowNotifications(false);
                                  go("customers");
                                }}
                              >
                                <div className="flex items-start gap-2.5">
                                  <span
                                    className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                                    style={{ background: "color-mix(in srgb, #E07A3A 16%, var(--surface))" }}
                                  >
                                    <CreditCard size={14} className="text-[#E07A3A]" />
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-[13px] font-semibold themed-title truncate">
                                      Outstanding credit · {c.name}
                                    </div>
                                    <div className="text-[11px] themed-muted mt-0.5">
                                      {inr(c.creditBalance)} pending collection
                                    </div>
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {notificationCount > 0 && (
                        <div
                          className="px-4 py-2.5 flex gap-2"
                          style={{ borderTop: "1px solid var(--border)" }}
                        >
                          {stats.lowStock.length > 0 && (
                            <button
                              className="btn text-xs flex-1"
                              onClick={() => {
                                setShowNotifications(false);
                                go("inventory");
                              }}
                            >
                              View inventory
                            </button>
                          )}
                          {creditCustomers.length > 0 && (
                            <button
                              className="btn text-xs flex-1"
                              onClick={() => {
                                setShowNotifications(false);
                                go("customers");
                              }}
                            >
                              View customers
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
              <div className="ml-1 flex items-center gap-2.5 pl-3" style={{ borderLeft: "1px solid var(--border)" }}>
                <div className="text-right hidden sm:block">
                  <div className="text-[13px] font-semibold themed-title">Hi, Admin</div>
                  <div className="text-[11px] themed-muted">{getGreeting()}</div>
                </div>
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold"
                  style={{
                    background: "linear-gradient(145deg, #0F766E 0%, #0EA5E9 100%)",
                    color: "#ecfdf8",
                    boxShadow: "0 3px 10px rgba(15, 118, 110, 0.28)",
                  }}
                >
                  DF
                </div>
              </div>
            </div>
          </header>

          <div className="flex-1 overflow-auto p-6 lg:p-8 animate-fade-in">
            <div className="mb-6 flex items-end justify-between gap-4 flex-wrap">
              <div>
                <h1 className="font-bold text-[22px] tracking-tight themed-title">
                  {navItems.find((n) => n.id === tab)?.label}
                </h1>
                <p className="text-[13px] themed-muted mt-1">
                  {tab === "overview" && "Your business at a glance"}
                  {tab === "inventory" && "Manage stock across all warehouses"}
                  {tab === "billing" && "Create a new bill for a customer"}
                  {tab === "bills" && "View and reprint past invoices"}
                  {tab === "customers" && "Customer accounts and credit ledger"}
                </p>
              </div>
              {tab === "overview" && (
                <button className="btn btn-primary" onClick={() => go("billing")}>
                  + Create Bill
                </button>
              )}
            </div>

            {tab === "overview" && (
              <Overview
                {...stats}
                onNavigate={go}
                onLowStockClick={openLowStockItem}
              />
            )}
            {tab === "inventory" && (
              <InventoryTab
                skus={skus}
                warehouses={warehouses}
                initialQuery={inventoryQuery}
                focusTarget={inventoryFocus}
                onFocusHandled={() => setInventoryFocus(null)}
              />
            )}
            {tab === "billing" && (
              <BillingTab
                skus={skus}
                warehouses={warehouses}
                customers={customers}
                onBillCreated={handleBillCreated}
              />
            )}
            {tab === "bills" && (
              <BillsTab
                bills={bills}
                onReprint={(b) => setPrintBill(b)}
                initialQuery={billsQuery}
                initialOpenId={openBillId}
              />
            )}
            {tab === "customers" && (
              <CustomersTab
                customers={customers}
                initialQuery={customersQuery}
                initialOpenId={openCustomerId}
              />
            )}
          </div>
        </main>
      </div>

      {printBill && <PrintModal bill={printBill} onClose={() => setPrintBill(null)} />}
      {showWarehouseModal && (
        <WarehouseModal
          warehouses={warehouses}
          onClose={() => {
            setShowWarehouseModal(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

export default function AppShell(props: {
  initialTab: string;
  stats: DashboardStats;
  warehouses: Warehouse[];
  skus: SkuWithDetails[];
  customers: Customer[];
  bills: Bill[];
}) {
  return (
    <ToastProvider>
      <AppShellInner {...props} />
    </ToastProvider>
  );
}
