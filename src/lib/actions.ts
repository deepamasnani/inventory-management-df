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
import { eq, and, sql, desc, asc, inArray, or } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "./auth";
import type { InventoryImportRow } from "./parse-inventory-xlsx";
import { formatSizeRange, indiaToday } from "./constants";

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
  const all = await db.select({ id: warehouses.id }).from(warehouses);
  if (all.length <= 1) {
    throw new Error("Keep at least one warehouse.");
  }
  await db.transaction(async (tx) => {
    await tx
      .update(bills)
      .set({ warehouseId: null })
      .where(eq(bills.warehouseId, id));
    await tx.delete(stock).where(eq(stock.warehouseId, id));
    await tx.delete(warehouses).where(eq(warehouses.id, id));
  });
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
    colour: string;
    remarks: string;
    pairsPerCarton: number;
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
        colour: c.colour || "",
        remarks: c.remarks || "",
        pairsPerCarton: c.pairsPerCarton || 0,
        prices: { A: c.priceA, B: c.priceB, C: c.priceC, D: c.priceD },
      })),
      stock: stockMap,
    };
  });
}

export async function addSku(data: {
  name: string;
  brand: string;
  categories: {
    label: string;
    colour?: string;
    remarks?: string;
    pairsPerCarton?: number;
    priceA: number;
    priceB: number;
    priceC: number;
    priceD: number;
  }[];
  initialStock: Record<number, number[]>; // warehouseId -> qty per category index
}) {
  await requireAdmin();
  const [sku] = await db.insert(skus).values({ name: data.name, brand: data.brand }).returning();
  const whList = await db.select().from(warehouses);

  for (let i = 0; i < data.categories.length; i++) {
    const cat = data.categories[i];
    const [inserted] = await db
      .insert(skuCategories)
      .values({
        skuId: sku.id,
        label: cat.label,
        colour: cat.colour?.trim() || "",
        remarks: cat.remarks?.trim() || "",
        pairsPerCarton: cat.pairsPerCarton || 0,
        priceA: cat.priceA,
        priceB: cat.priceB,
        priceC: cat.priceC,
        priceD: cat.priceD,
      })
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

function normKey(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

export async function importInventoryRows(
  warehouseId: number,
  rows: InventoryImportRow[]
) {
  await requireAdmin();
  const [wh] = await db.select().from(warehouses).where(eq(warehouses.id, warehouseId)).limit(1);
  if (!wh) throw new Error("Warehouse not found.");

  const allWh = await db.select().from(warehouses);
  const existingSkus = await db.select().from(skus);
  const existingCats = await db.select().from(skuCategories);
  const existingStock = await db.select().from(stock);

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const brand = row.brand.trim().replace(/\s+/g, " ");
    const name = row.name.trim().replace(/\s+/g, " ");
    if (!brand || !name) continue;
    const label = row.size.trim();
    const colour = row.colour.trim();
    const remarks = row.remarks.trim();
    const qty = Math.max(0, Math.round(Number(row.qty) || 0));
    const ppc = Number(row.pairsPerCarton) || 0;

    let sku = existingSkus.find(
      (s) => normKey(s.brand) === normKey(brand) && normKey(s.name) === normKey(name)
    );
    if (!sku) {
      const [inserted] = await db.insert(skus).values({ brand, name }).returning();
      sku = inserted;
      existingSkus.push(inserted);
    }

    let cat = existingCats.find(
      (c) =>
        c.skuId === sku!.id &&
        normKey(c.label) === normKey(label) &&
        normKey(c.colour || "") === normKey(colour) &&
        normKey(c.remarks || "") === normKey(remarks)
    );
    if (!cat) {
      const [inserted] = await db
        .insert(skuCategories)
        .values({
          skuId: sku.id,
          label,
          colour,
          remarks,
          pairsPerCarton: ppc,
          priceA: 0,
          priceB: 0,
          priceC: 0,
          priceD: 0,
        })
        .returning();
      cat = inserted;
      existingCats.push(inserted);
      const stockRows = allWh.map((w) => ({
        skuCategoryId: inserted.id,
        warehouseId: w.id,
        qty: w.id === warehouseId ? qty : 0,
      }));
      if (stockRows.length > 0) {
        const insertedStock = await db.insert(stock).values(stockRows).returning();
        existingStock.push(...insertedStock);
      }
      created += 1;
    } else {
      await db
        .update(skuCategories)
        .set({ pairsPerCarton: ppc || cat.pairsPerCarton || 0 })
        .where(eq(skuCategories.id, cat.id));
      const st = existingStock.find(
        (s) => s.skuCategoryId === cat!.id && s.warehouseId === warehouseId
      );
      if (st) {
        await db
          .update(stock)
          .set({ qty })
          .where(and(eq(stock.skuCategoryId, cat.id), eq(stock.warehouseId, warehouseId)));
        st.qty = qty;
      } else {
        const [row] = await db
          .insert(stock)
          .values({ skuCategoryId: cat.id, warehouseId, qty })
          .returning();
        existingStock.push(row);
      }
      updated += 1;
    }
  }

  revalidatePath("/");
  return { created, updated };
}

export async function deleteBrandFolder(brand: string) {
  await requireAdmin();
  const folder = brand.trim() || "Unbranded";
  const allSkus = await db.select().from(skus);
  const ids = allSkus
    .filter((s) => (s.brand.trim() || "Unbranded") === folder)
    .map((s) => s.id);
  if (ids.length === 0) return { deleted: 0 };
  await db.transaction(async (tx) => {
    await unlinkThenDeleteSkus(ids, tx);
  });
  revalidatePath("/");
  return { deleted: ids.length };
}

async function unlinkThenDeleteSkus(
  ids: number[],
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0]
) {
  if (ids.length === 0) return;
  const cats = await tx
    .select({ id: skuCategories.id })
    .from(skuCategories)
    .where(inArray(skuCategories.skuId, ids));
  const catIds = cats.map((c) => c.id);
  if (catIds.length > 0) {
    await tx
      .update(billItems)
      .set({ skuCategoryId: null })
      .where(inArray(billItems.skuCategoryId, catIds));
  }
  await tx.delete(skus).where(inArray(skus.id, ids));
}

export async function deleteSku(skuId: number) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    await unlinkThenDeleteSkus([skuId], tx);
  });
  revalidatePath("/");
}

export async function updateSkuDetails(data: {
  id: number;
  name: string;
  brand: string;
  categories: { id: number; label: string; colour: string; remarks: string }[];
}) {
  await requireAdmin();
  const name = data.name.trim();
  const brand = data.brand.trim();
  if (!name || !brand) throw new Error("Article name and company are required.");
  await db.update(skus).set({ name, brand }).where(eq(skus.id, data.id));
  for (const cat of data.categories) {
    await db
      .update(skuCategories)
      .set({
        label: formatSizeRange(cat.label),
        colour: cat.colour.trim(),
        remarks: cat.remarks.trim(),
      })
      .where(and(eq(skuCategories.id, cat.id), eq(skuCategories.skuId, data.id)));
  }
  revalidatePath("/");
}

export async function transferStock(
  fromWarehouseId: number,
  toWarehouseId: number,
  moves: { skuCategoryId: number; qty: number }[]
) {
  await requireAdmin();
  if (fromWarehouseId === toWarehouseId) {
    throw new Error("Pick two different warehouses.");
  }
  const [fromWh] = await db.select().from(warehouses).where(eq(warehouses.id, fromWarehouseId)).limit(1);
  const [toWh] = await db.select().from(warehouses).where(eq(warehouses.id, toWarehouseId)).limit(1);
  if (!fromWh || !toWh) throw new Error("Warehouse not found.");

  await db.transaction(async (tx) => {
    for (const move of moves) {
      const qty = Math.max(0, Math.round(Number(move.qty) || 0));
      if (qty <= 0) continue;
      const [fromRow] = await tx
        .update(stock)
        .set({ qty: sql`${stock.qty} - ${qty}` })
        .where(
          and(
            eq(stock.skuCategoryId, move.skuCategoryId),
            eq(stock.warehouseId, fromWarehouseId),
            sql`${stock.qty} >= ${qty}`
          )
        )
        .returning();
      if (!fromRow) {
        throw new Error("Not enough pairs in the source warehouse.");
      }
      const [toRow] = await tx
        .select()
        .from(stock)
        .where(
          and(eq(stock.skuCategoryId, move.skuCategoryId), eq(stock.warehouseId, toWarehouseId))
        )
        .limit(1);
      if (toRow) {
        await tx
          .update(stock)
          .set({ qty: sql`${stock.qty} + ${qty}` })
          .where(eq(stock.id, toRow.id));
      } else {
        await tx.insert(stock).values({
          skuCategoryId: move.skuCategoryId,
          warehouseId: toWarehouseId,
          qty,
        });
      }
    }
  });
  revalidatePath("/");
}

export async function updateSkuPrices(
  prices: Record<number, { A: number; B: number; C: number; D: number; pairsPerCarton?: number }>
) {
  await requireAdmin();
  for (const [catIdStr, p] of Object.entries(prices)) {
    const catId = Number(catIdStr);
    await db
      .update(skuCategories)
      .set({
        priceA: p.A,
        priceB: p.B,
        priceC: p.C,
        priceD: p.D,
        ...(p.pairsPerCarton != null ? { pairsPerCarton: p.pairsPerCarton } : {}),
      })
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
    date: indiaToday(),
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
  if (!input.items.length) throw new Error("Add at least one item.");

  const date = indiaToday();
  for (const item of input.items) {
    if (!Number.isFinite(item.qty) || item.qty < 1) {
      throw new Error("Each line needs at least 1 pair.");
    }
  }
  const bill = await db.transaction(async (tx) => {
    const [inserted] = await tx
      .insert(bills)
      .values({
        invoiceNo: "pending",
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
        status: "active",
      })
      .returning();

    const invoiceNo = `INV-${inserted.id}`;
    await tx.update(bills).set({ invoiceNo }).where(eq(bills.id, inserted.id));

    await tx.insert(billItems).values(
      input.items.map((it) => ({
        billId: inserted.id,
        skuCategoryId: it.skuCategoryId,
        skuName: it.skuName,
        brand: it.brand,
        categoryLabel: it.categoryLabel,
        qty: it.qty,
        price: it.price,
        subtotal: it.subtotal,
      }))
    );

    for (const item of input.items) {
      const [row] = await tx
        .update(stock)
        .set({ qty: sql`${stock.qty} - ${item.qty}` })
        .where(
          and(
            eq(stock.skuCategoryId, item.skuCategoryId),
            eq(stock.warehouseId, input.warehouseId),
            sql`${stock.qty} >= ${item.qty}`
          )
        )
        .returning();
      if (!row) {
        throw new Error(`Not enough stock for ${item.brand} ${item.skuName}.`);
      }
    }

    await tx
      .update(customers)
      .set({
        creditBalance: sql`${customers.creditBalance} + ${input.balance} + ${input.claim}`,
      })
      .where(eq(customers.id, input.customerId));

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
      await tx.insert(payments).values(paymentRows);
    }

    return { ...inserted, invoiceNo };
  });

  revalidatePath("/");
  return { ...bill, items: input.items };
}

export async function voidBill(billId: number) {
  await requireAdmin();
  await db.transaction(async (tx) => {
    const [bill] = await tx
      .select()
      .from(bills)
      .where(eq(bills.id, billId))
      .for("update")
      .limit(1);
    if (!bill) throw new Error("Bill not found.");
    if (bill.status === "voided") throw new Error("This bill is already voided.");

    const items = await tx.select().from(billItems).where(eq(billItems.billId, billId));
    for (const item of items) {
      if (!item.skuCategoryId || !bill.warehouseId) continue;
      const [row] = await tx
        .select()
        .from(stock)
        .where(
          and(
            eq(stock.skuCategoryId, item.skuCategoryId),
            eq(stock.warehouseId, bill.warehouseId)
          )
        )
        .limit(1);
      if (row) {
        await tx
          .update(stock)
          .set({ qty: sql`${stock.qty} + ${item.qty}` })
          .where(eq(stock.id, row.id));
      }
    }

    await tx
      .update(customers)
      .set({
        creditBalance: sql`${customers.creditBalance} - ${bill.balance} - ${bill.claim}`,
      })
      .where(eq(customers.id, bill.customerId));

    await tx
      .delete(payments)
      .where(
        and(
          eq(payments.customerId, bill.customerId),
          or(
            eq(payments.note, `Bill ${bill.invoiceNo}`),
            eq(payments.note, `Applied to Bill ${bill.invoiceNo}`)
          )
        )
      );

    await tx.update(bills).set({ status: "voided" }).where(eq(bills.id, billId));
  });
  revalidatePath("/");
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

  const liveBills = allBills.filter((b) => b.status !== "voided");

  const outstandingCredit = allCustomers.reduce(
    (sum, c) => sum + Math.max(0, c.creditBalance),
    0
  );

  const revenueCollected = liveBills.reduce(
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
    .filter((s) => s.qty > 0 && s.qty < 8)
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
