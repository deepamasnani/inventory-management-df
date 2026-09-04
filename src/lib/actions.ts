"use server";

import { db } from "@/db";
import {
  warehouses,
  skus,
  skuCategories,
  stock,
  customers,
  bills,
  billItems,
  payments,
} from "@/db/schema";
import { eq, and, sql, lt, desc, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";

// ── Warehouses ──────────────────────────────────────────

export async function getWarehouses() {
  await requireAdmin();
  return db.select().from(warehouses).orderBy(asc(warehouses.id));
}

export async function addWarehouse(name: string) {
  await requireAdmin();
  const [wh] = await db.insert(warehouses).values({ name }).returning();
  // Create stock rows for all existing sku categories
  const cats = await db.select({ id: skuCategories.id }).from(skuCategories);
  if (cats.length > 0) {
    await db.insert(stock).values(
      cats.map((c) => ({ skuCategoryId: c.id, warehouseId: wh.id, qty: 0 }))
    );
  }
  revalidatePath("/");
  return wh;
}

export async function renameWarehouse(id: number, name: string) {
  await requireAdmin();
  await db.update(warehouses).set({ name }).where(eq(warehouses.id, id));
  revalidatePath("/");
}

export async function deleteWarehouse(id: number) {
  await requireAdmin();
  await db.delete(warehouses).where(eq(warehouses.id, id));
  revalidatePath("/");
}

// ── SKUs & Inventory ────────────────────────────────────

export type SkuWithDetails = {
  id: number;
  name: string;
  brand: string;
  categories: {
    id: number;
    label: string;
    prices: { A: number; B: number; C: number; D: number };
  }[];
  stock: Record<number, Record<number, number>>; // warehouseId -> catId -> qty
};

export async function getSkusWithStock(): Promise<SkuWithDetails[]> {
  await requireAdmin();
  const allSkus = await db.select().from(skus).orderBy(asc(skus.id));
  const allCats = await db.select().from(skuCategories).orderBy(asc(skuCategories.id));
  const allStock = await db.select().from(stock);
  const allWarehouses = await db.select().from(warehouses);

  return allSkus.map((s) => {
    const cats = allCats.filter((c) => c.skuId === s.id);
    const stockMap: Record<number, Record<number, number>> = {};
    allWarehouses.forEach((w) => {
      stockMap[w.id] = {};
      cats.forEach((c) => {
        const row = allStock.find(
          (st) => st.skuCategoryId === c.id && st.warehouseId === w.id
        );
        stockMap[w.id][c.id] = row?.qty ?? 0;
      });
    });
    return {
      id: s.id,
      name: s.name,
      brand: s.brand,
      categories: cats.map((c) => ({
        id: c.id,
        label: c.label,
        prices: { A: c.priceA, B: c.priceB, C: c.priceC, D: c.priceD },
      })),
      stock: stockMap,
    };
  });
}

export async function addSku(data: {
  name: string;
  brand: string;
  categories: { label: string; priceA: number; priceB: number; priceC: number; priceD: number }[];
  initialStock: Record<number, number[]>; // warehouseId -> qty per category index
}) {
  await requireAdmin();
  const [sku] = await db.insert(skus).values({ name: data.name, brand: data.brand }).returning();
  const whList = await db.select().from(warehouses);

  for (let i = 0; i < data.categories.length; i++) {
    const cat = data.categories[i];
    const [inserted] = await db
      .insert(skuCategories)
      .values({ skuId: sku.id, label: cat.label, priceA: cat.priceA, priceB: cat.priceB, priceC: cat.priceC, priceD: cat.priceD })
      .returning();

    const stockRows = whList.map((w) => ({
      skuCategoryId: inserted.id,
      warehouseId: w.id,
      qty: data.initialStock[w.id]?.[i] ?? 0,
    }));
    if (stockRows.length > 0) {
      await db.insert(stock).values(stockRows);
    }
  }
  revalidatePath("/");
}

export async function updateSkuPrices(
  prices: Record<number, { A: number; B: number; C: number; D: number }>
) {
  await requireAdmin();
  for (const [catIdStr, p] of Object.entries(prices)) {
    const catId = Number(catIdStr);
    await db
      .update(skuCategories)
      .set({ priceA: p.A, priceB: p.B, priceC: p.C, priceD: p.D })
      .where(eq(skuCategories.id, catId));
  }
  revalidatePath("/");
}

export async function adjustStock(
  skuCategoryId: number,
  warehouseId: number,
  newQty: number
) {
  await requireAdmin();
  await db
    .update(stock)
    .set({ qty: Math.max(0, newQty) })
    .where(
      and(eq(stock.skuCategoryId, skuCategoryId), eq(stock.warehouseId, warehouseId))
    );
  revalidatePath("/");
}

// ── Customers ───────────────────────────────────────────

export async function getCustomers() {
  await requireAdmin();
  return db.select().from(customers).orderBy(asc(customers.id));
}

export async function addCustomer(name: string, type: string) {
  await requireAdmin();
  const [c] = await db
    .insert(customers)
    .values({ name, type, creditBalance: 0 })
    .returning();
  revalidatePath("/");
  return c;
}

export async function deleteCustomer(customerId: number) {
  await requireAdmin();
  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer not found.");
  }

  const customerBills = await db
    .select({ id: bills.id })
    .from(bills)
    .where(eq(bills.customerId, customerId));

  if (customerBills.length > 0) {
    const billIds = customerBills.map((b) => b.id);
    for (const billId of billIds) {
      await db.delete(billItems).where(eq(billItems.billId, billId));
    }
    await db.delete(bills).where(eq(bills.customerId, customerId));
  }

  await db.delete(payments).where(eq(payments.customerId, customerId));
  await db.delete(customers).where(eq(customers.id, customerId));
  revalidatePath("/");
}

export async function settleCredit(
  customerId: number,
  amount: number,
  method: string
) {
  await requireAdmin();
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Enter a valid payment amount.");
  }

  const [customer] = await db
    .select()
    .from(customers)
    .where(eq(customers.id, customerId))
    .limit(1);

  if (!customer) {
    throw new Error("Customer not found.");
  }

  if (customer.creditBalance <= 0) {
    throw new Error("This customer has no outstanding credit to settle.");
  }

  if (amount > customer.creditBalance) {
    throw new Error(
      `Payment cannot exceed outstanding credit of ₹${customer.creditBalance.toLocaleString("en-IN")}.`
    );
  }

  await db
    .update(customers)
    .set({
      creditBalance: sql`${customers.creditBalance} - ${amount}`,
    })
    .where(eq(customers.id, customerId));

  await db.insert(payments).values({
    customerId,
    date: new Date().toISOString().slice(0, 10),
    amount,
    method,
    note: "Credit settlement",
  });
  revalidatePath("/");
}

export async function getPayments(customerId: number) {
  await requireAdmin();
  return db
    .select()
    .from(payments)
    .where(eq(payments.customerId, customerId))
    .orderBy(desc(payments.id));
}

export async function deletePayment(paymentId: number) {
  await requireAdmin();
  const [payment] = await db
    .select()
    .from(payments)
    .where(eq(payments.id, paymentId))
    .limit(1);

  if (!payment) {
    throw new Error("Payment not found.");
  }

  // Credit settlements reduce outstanding credit — restore it when deleted.
  if (payment.note === "Credit settlement") {
    await db
      .update(customers)
      .set({
        creditBalance: sql`${customers.creditBalance} + ${payment.amount}`,
      })
      .where(eq(customers.id, payment.customerId));
  }

  await db.delete(payments).where(eq(payments.id, paymentId));
  revalidatePath("/");
}

// ── Bills ───────────────────────────────────────────────

export type BillInput = {
  customerId: number;
  customerName: string;
  customerType: string;
  warehouseId: number;
  warehouseName: string;
  items: {
    skuCategoryId: number;
    skuName: string;
    brand: string;
    categoryLabel: string;
    qty: number;
    price: number;
    subtotal: number;
  }[];
  subtotal: number;
  discount: number;
  claim: number;
  total: number;
  paidCash: number;
  paidOnline: number;
  balance: number;
};

export async function createBill(input: BillInput) {
  await requireAdmin();
  // Get next invoice number
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bills);
  const invoiceNo = `INV-${2001 + (countResult?.count ?? 0)}`;
  const date = new Date().toISOString().slice(0, 10);

  // Insert bill
  const [bill] = await db
    .insert(bills)
    .values({
      invoiceNo,
      date,
      customerId: input.customerId,
      customerName: input.customerName,
      customerType: input.customerType,
      warehouseId: input.warehouseId,
      warehouseName: input.warehouseName,
      subtotal: input.subtotal,
      discount: input.discount,
      claim: input.claim,
      total: input.total,
      paidCash: input.paidCash,
      paidOnline: input.paidOnline,
      balance: input.balance,
    })
    .returning();

  // Insert bill items
  if (input.items.length > 0) {
    await db.insert(billItems).values(
      input.items.map((it) => ({
        billId: bill.id,
        skuCategoryId: it.skuCategoryId,
        skuName: it.skuName,
        brand: it.brand,
        categoryLabel: it.categoryLabel,
        qty: it.qty,
        price: it.price,
        subtotal: it.subtotal,
      }))
    );
  }

  // Deduct stock
  for (const item of input.items) {
    await db
      .update(stock)
      .set({ qty: sql`GREATEST(0, ${stock.qty} - ${item.qty})` })
      .where(
        and(
          eq(stock.skuCategoryId, item.skuCategoryId),
          eq(stock.warehouseId, input.warehouseId)
        )
      );
  }

  // Update customer credit
  await db
    .update(customers)
    .set({
      creditBalance: sql`${customers.creditBalance} + ${input.balance} + ${input.claim}`,
    })
    .where(eq(customers.id, input.customerId));

  // Record payments
  const paymentRows = [];
  if (input.paidCash > 0) {
    paymentRows.push({
      customerId: input.customerId,
      date,
      amount: input.paidCash,
      method: "Cash",
      note: `Bill ${invoiceNo}`,
    });
  }
  if (input.paidOnline > 0) {
    paymentRows.push({
      customerId: input.customerId,
      date,
      amount: input.paidOnline,
      method: "Online",
      note: `Bill ${invoiceNo}`,
    });
  }
  if (input.claim > 0) {
    paymentRows.push({
      customerId: input.customerId,
      date,
      amount: input.claim,
      method: "Claim",
      note: `Applied to Bill ${invoiceNo}`,
    });
  }
  if (paymentRows.length > 0) {
    await db.insert(payments).values(paymentRows);
  }

  revalidatePath("/");
  return { ...bill, items: input.items };
}

export async function getBills() {
  await requireAdmin();
  return db.select().from(bills).orderBy(desc(bills.id));
}

export async function getBillItems(billId: number) {
  await requireAdmin();
  return db.select().from(billItems).where(eq(billItems.billId, billId));
}

// ── Dashboard stats ─────────────────────────────────────

export async function getDashboardStats() {
  await requireAdmin();
  const allSkus = await db.select().from(skus);
  const allStock = await db.select().from(stock);
  const allCats = await db.select().from(skuCategories);
  const allCustomers = await db.select().from(customers);
  const allBills = await db.select().from(bills);
  const allWarehouses = await db.select().from(warehouses);

  const totalSkus = allSkus.length;
  const totalPairs = allStock.reduce((sum, s) => sum + s.qty, 0);

  // Inventory value at Type A prices
  const inventoryValue = allStock.reduce((sum, s) => {
    const cat = allCats.find((c) => c.id === s.skuCategoryId);
    return sum + s.qty * (cat?.priceA ?? 0);
  }, 0);

  const outstandingCredit = allCustomers.reduce(
    (sum, c) => sum + Math.max(0, c.creditBalance),
    0
  );

  const revenueCollected = allBills.reduce(
    (sum, b) => sum + b.paidCash + b.paidOnline,
    0
  );

  // Low stock items
  const lowStock: {
    skuId: number;
    warehouseId: number;
    sku: string;
    brand: string;
    warehouse: string;
    category: string;
    qty: number;
  }[] = [];

  allStock
    .filter((s) => s.qty < 8)
    .forEach((s) => {
      const cat = allCats.find((c) => c.id === s.skuCategoryId);
      const sku = allSkus.find((sk) => sk.id === cat?.skuId);
      const wh = allWarehouses.find((w) => w.id === s.warehouseId);
      if (cat && sku && wh) {
        lowStock.push({
          skuId: sku.id,
          warehouseId: wh.id,
          sku: sku.name,
          brand: sku.brand,
          warehouse: wh.name,
          category: cat.label,
          qty: s.qty,
        });
      }
    });

  lowStock.sort((a, b) => a.qty - b.qty);

  const recentBills = allBills
    .sort((a, b) => b.id - a.id)
    .slice(0, 8);

  return {
    totalSkus,
    totalPairs,
    inventoryValue,
    outstandingCredit,
    revenueCollected,
    lowStock: lowStock.slice(0, 8),
    recentBills,
  };
}
