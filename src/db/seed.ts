import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import * as schema from "./schema";
import * as dotenv from "dotenv";
import { hashPassword } from "../lib/password";
import { DEFAULT_ADMIN } from "../lib/constants";

dotenv.config({ path: ".env.local" });

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING ||
  process.env.POSTGRES_URL ||
  process.env.DATABASE_URL ||
  "postgresql://postgres:postgres@localhost:5432/devfootwear";
const isLocal = connectionString.includes("localhost") || connectionString.includes("127.0.0.1");
const client = postgres(connectionString, {
  ssl: isLocal ? false : "require",
  prepare: false,
  max: 1,
});
const db = drizzle(client, { schema });

const WAREHOUSE_NAMES = [
  "Saharanpur Central",
  "Delhi Hub",
  "Meerut Depot",
  "Dehradun Store",
  "Haridwar Point",
  "Muzaffarnagar Unit",
  "Roorkee Outlet",
];

const CAT_LABELS = ["UK 6-7", "UK 8-9", "UK 10-11", "UK 12-13"];

const SKU_DATA = [
  { name: "Air Max 90", brand: "Nike", basePrice: 1800 },
  { name: "Ultraboost 22", brand: "Adidas", basePrice: 2200 },
  { name: "RS-X3", brand: "Puma", basePrice: 1600 },
  { name: "Trekker GB", brand: "Woodland", basePrice: 1400 },
  { name: "Comfit Walk", brand: "Bata", basePrice: 700 },
  { name: "Force 10", brand: "Liberty", basePrice: 850 },
  { name: "Sparx Pro", brand: "Relaxo", basePrice: 500 },
  { name: "Oxyfit Run", brand: "Campus", basePrice: 950 },
];

const CUSTOMER_DATA = [
  { name: "Rahul Traders", type: "B", creditBalance: 4200 },
  { name: "Singh Footwear Corner", type: "C", creditBalance: 0 },
  { name: "Verma & Sons", type: "A", creditBalance: 1500 },
];

function seedRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

async function main() {
  console.log("Seeding database...");

  // Create tables
  await client`
    CREATE TABLE IF NOT EXISTS warehouses (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS skus (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      brand TEXT NOT NULL
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS sku_categories (
      id SERIAL PRIMARY KEY,
      sku_id INTEGER NOT NULL REFERENCES skus(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      price_a INTEGER NOT NULL DEFAULT 0,
      price_b INTEGER NOT NULL DEFAULT 0,
      price_c INTEGER NOT NULL DEFAULT 0,
      price_d INTEGER NOT NULL DEFAULT 0
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS stock (
      id SERIAL PRIMARY KEY,
      sku_category_id INTEGER NOT NULL REFERENCES sku_categories(id) ON DELETE CASCADE,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
      qty INTEGER NOT NULL DEFAULT 0
    )
  `;
  await client`CREATE UNIQUE INDEX IF NOT EXISTS stock_cat_wh_uniq ON stock(sku_category_id, warehouse_id)`;
  await client`
    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'A',
      credit_balance INTEGER NOT NULL DEFAULT 0
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS bills (
      id SERIAL PRIMARY KEY,
      invoice_no TEXT NOT NULL,
      date TEXT NOT NULL,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      customer_name TEXT NOT NULL,
      customer_type TEXT NOT NULL,
      warehouse_id INTEGER NOT NULL REFERENCES warehouses(id),
      warehouse_name TEXT NOT NULL,
      subtotal INTEGER NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      claim INTEGER NOT NULL DEFAULT 0,
      total INTEGER NOT NULL DEFAULT 0,
      paid_cash INTEGER NOT NULL DEFAULT 0,
      paid_online INTEGER NOT NULL DEFAULT 0,
      balance INTEGER NOT NULL DEFAULT 0
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS bill_items (
      id SERIAL PRIMARY KEY,
      bill_id INTEGER NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
      sku_category_id INTEGER NOT NULL REFERENCES sku_categories(id),
      sku_name TEXT NOT NULL,
      brand TEXT NOT NULL,
      category_label TEXT NOT NULL,
      qty INTEGER NOT NULL,
      price INTEGER NOT NULL,
      subtotal INTEGER NOT NULL
    )
  `;
  await client`
    CREATE TABLE IF NOT EXISTS payments (
      id SERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      method TEXT NOT NULL,
      note TEXT DEFAULT ''
    )
  `;

  await client`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;
  await client`CREATE UNIQUE INDEX IF NOT EXISTS admins_username_uniq ON admins (username)`;
  await client`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `;

  // Clear existing data
  await client`TRUNCATE password_reset_otps, payments, bill_items, bills, stock, sku_categories, skus, customers, warehouses, admins RESTART IDENTITY CASCADE`;

  // Seed warehouses
  const warehouseIds: number[] = [];
  for (const name of WAREHOUSE_NAMES) {
    const [wh] = await db.insert(schema.warehouses).values({ name }).returning();
    warehouseIds.push(wh.id);
  }
  console.log(`  ${warehouseIds.length} warehouses created`);

  // Seed SKUs with categories and stock
  for (let si = 0; si < SKU_DATA.length; si++) {
    const { name, brand, basePrice } = SKU_DATA[si];
    const [sku] = await db.insert(schema.skus).values({ name, brand }).returning();

    const rnd = seedRand(name.charCodeAt(name.length - 1) * 17 + name.length * 3);

    for (let ci = 0; ci < CAT_LABELS.length; ci++) {
      const bump = ci * 40;
      const priceA = Math.round((basePrice + bump) * 1.35 / 10) * 10;
      const priceB = Math.round((basePrice + bump) * 1.2 / 10) * 10;
      const priceC = Math.round((basePrice + bump) * 1.1 / 10) * 10;
      const priceD = Math.round((basePrice + bump) * 1.0 / 10) * 10;

      const [cat] = await db
        .insert(schema.skuCategories)
        .values({ skuId: sku.id, label: CAT_LABELS[ci], priceA, priceB, priceC, priceD })
        .returning();

      for (let wi = 0; wi < warehouseIds.length; wi++) {
        const qty = Math.floor(rnd() * 45) + (wi === 0 ? 20 : 0) + (ci === 0 ? 10 : 0);
        await db.insert(schema.stock).values({
          skuCategoryId: cat.id,
          warehouseId: warehouseIds[wi],
          qty,
        });
      }
    }
  }
  console.log(`  ${SKU_DATA.length} SKUs seeded with stock`);

  // Seed customers
  for (const c of CUSTOMER_DATA) {
    await db.insert(schema.customers).values(c);
  }
  console.log(`  ${CUSTOMER_DATA.length} customers created`);

  await db.insert(schema.admins).values({
    username: DEFAULT_ADMIN.username,
    passwordHash: await hashPassword(DEFAULT_ADMIN.password),
    email: DEFAULT_ADMIN.email,
  });
  console.log(`  Default admin created (${DEFAULT_ADMIN.username})`);

  // Seed initial payments
  const [rahul] = await db.select().from(schema.customers).where(
    eq(schema.customers.name, "Rahul Traders")
  );
  if (rahul) {
    await db.insert(schema.payments).values({
      customerId: rahul.id,
      date: "2026-07-28",
      amount: 6000,
      method: "Online",
      note: "Advance",
    });
  }

  const [verma] = await db.select().from(schema.customers).where(
    eq(schema.customers.name, "Verma & Sons")
  );
  if (verma) {
    await db.insert(schema.payments).values({
      customerId: verma.id,
      date: "2026-08-02",
      amount: 2000,
      method: "Cash",
      note: "Part payment",
    });
  }

  console.log("Seeding complete!");
  await client.end();
  process.exit(0);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
