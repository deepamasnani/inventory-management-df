import { getDashboardStats, getWarehouses, getSkusWithStock, getCustomers, getBills, getAllPayments } from "@/lib/actions";
import { ensureDefaultAdmin } from "@/lib/auth";
import AppShell from "@/components/AppShell";

export const dynamic = "force-dynamic";

const TABS = ["overview", "inventory", "shop", "billing", "bills", "customers", "notifications"] as const;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await ensureDefaultAdmin();
  const params = await searchParams;
  const initialTab = TABS.includes(params.tab as (typeof TABS)[number])
    ? (params.tab as string)
    : "overview";

  const [stats, warehouses, skus, customers, allBills, allPayments] = await Promise.all([
    getDashboardStats(),
    getWarehouses(),
    getSkusWithStock(),
    getCustomers(),
    getBills(),
    getAllPayments(),
  ]);

  return (
    <AppShell
      initialTab={initialTab}
      stats={stats}
      warehouses={warehouses}
      skus={skus}
      customers={customers}
      bills={allBills}
      payments={allPayments}
    />
  );
}
