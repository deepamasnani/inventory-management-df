import { pgTable, text, integer, numeric, timestamp, serial, uniqueIndex } from "drizzle-orm/pg-core";

export const warehouses = pgTable("warehouses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const skus = pgTable("skus", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
});

export const skuCategories = pgTable("sku_categories", {
  id: serial("id").primaryKey(),
  skuId: integer("sku_id").notNull().references(() => skus.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  priceA: integer("price_a").notNull().default(0),
  priceB: integer("price_b").notNull().default(0),
  priceC: integer("price_c").notNull().default(0),
  priceD: integer("price_d").notNull().default(0),
});

export const stock = pgTable("stock", {
  id: serial("id").primaryKey(),
  skuCategoryId: integer("sku_category_id").notNull().references(() => skuCategories.id, { onDelete: "cascade" }),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id, { onDelete: "cascade" }),
  qty: integer("qty").notNull().default(0),
}, (table) => ({
  uniq: uniqueIndex("stock_cat_wh_uniq").on(table.skuCategoryId, table.warehouseId),
}));

export const customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull().default("A"),
  creditBalance: integer("credit_balance").notNull().default(0),
});

export const bills = pgTable("bills", {
  id: serial("id").primaryKey(),
  invoiceNo: text("invoice_no").notNull(),
  date: text("date").notNull(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  customerName: text("customer_name").notNull(),
  customerType: text("customer_type").notNull(),
  warehouseId: integer("warehouse_id").notNull().references(() => warehouses.id),
  warehouseName: text("warehouse_name").notNull(),
  subtotal: integer("subtotal").notNull().default(0),
  discount: integer("discount").notNull().default(0),
  claim: integer("claim").notNull().default(0),
  total: integer("total").notNull().default(0),
  paidCash: integer("paid_cash").notNull().default(0),
  paidOnline: integer("paid_online").notNull().default(0),
  balance: integer("balance").notNull().default(0),
});

export const billItems = pgTable("bill_items", {
  id: serial("id").primaryKey(),
  billId: integer("bill_id").notNull().references(() => bills.id, { onDelete: "cascade" }),
  skuCategoryId: integer("sku_category_id").notNull().references(() => skuCategories.id),
  skuName: text("sku_name").notNull(),
  brand: text("brand").notNull(),
  categoryLabel: text("category_label").notNull(),
  qty: integer("qty").notNull(),
  price: integer("price").notNull(),
  subtotal: integer("subtotal").notNull(),
});

export const admins = pgTable("admins", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  passwordHash: text("password_hash").notNull(),
  email: text("email").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  usernameUniq: uniqueIndex("admins_username_uniq").on(table.username),
}));

export const passwordResetOtps = pgTable("password_reset_otps", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  codeHash: text("code_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  customerId: integer("customer_id").notNull().references(() => customers.id),
  date: text("date").notNull(),
  amount: integer("amount").notNull(),
  method: text("method").notNull(),
  note: text("note").default(""),
});
