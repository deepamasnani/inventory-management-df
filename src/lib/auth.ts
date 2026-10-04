import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins, warehouses } from "@/db/schema";
import { hashPassword } from "./password";
import { SESSION_COOKIE, SESSION_MAX_AGE, readSession, signSession } from "./session";
import { DEFAULT_ADMIN } from "./constants";
import { normalizeEmail } from "./email";

export { SESSION_COOKIE } from "./session";
export { DEFAULT_ADMIN } from "./constants";

export async function getSessionAdminId(): Promise<number | null> {
  const store = await cookies();
  return await readSession(store.get(SESSION_COOKIE)?.value);
}

export async function setSessionCookie(adminId: number) {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(adminId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

export async function ensureAdminTable() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS admins (
      id SERIAL PRIMARY KEY,
      username TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS admins_username_uniq ON admins (username)
  `);
  await db.execute(sql`
    ALTER TABLE admins ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT ''
  `);
  await db.execute(sql`
    UPDATE admins
    SET email = ${DEFAULT_ADMIN.email}
    WHERE email IS NULL OR email = ''
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id SERIAL PRIMARY KEY,
      email TEXT NOT NULL,
      code_hash TEXT NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await db.execute(sql`ALTER TABLE sku_categories ADD COLUMN IF NOT EXISTS colour TEXT NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE sku_categories ADD COLUMN IF NOT EXISTS remarks TEXT NOT NULL DEFAULT ''`);
  await db.execute(sql`ALTER TABLE sku_categories ADD COLUMN IF NOT EXISTS pairs_per_carton DOUBLE PRECISION NOT NULL DEFAULT 0`);
  await db.execute(sql`ALTER TABLE bill_items ALTER COLUMN sku_category_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`);
  await db.execute(sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS dispatch_status TEXT NOT NULL DEFAULT 'pending'`);
  await db.execute(sql`ALTER TABLE payments ADD COLUMN IF NOT EXISTS bill_id INTEGER`);
  await db.execute(sql`
    UPDATE payments p
    SET bill_id = b.id
    FROM bills b
    WHERE p.bill_id IS NULL
      AND (
        p.note = 'Bill ' || b.invoice_no
        OR p.note = 'Applied to Bill ' || b.invoice_no
        OR p.note = 'Bill credit ' || b.invoice_no
      )
  `);
  await db.execute(sql`ALTER TABLE bills ALTER COLUMN warehouse_id DROP NOT NULL`);
  await db.execute(sql`ALTER TABLE warehouses ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'godown'`);
  await db.execute(sql`UPDATE warehouses SET kind = 'godown' WHERE kind IS NULL OR kind = ''`);
  const shops = await db.select({ id: warehouses.id }).from(warehouses).where(eq(warehouses.kind, "shop")).limit(1);
  if (shops.length === 0) {
    await db.insert(warehouses).values({ name: "SHOP", kind: "shop" });
  }
}

export async function ensureDefaultAdmin() {
  await ensureAdminTable();
  const existing = await db.select({ id: admins.id }).from(admins).limit(1);
  if (existing.length > 0) return;
  await db.insert(admins).values({
    username: DEFAULT_ADMIN.username,
    passwordHash: await hashPassword(DEFAULT_ADMIN.password),
    email: normalizeEmail(DEFAULT_ADMIN.email),
  });
}

export async function requireAdmin() {
  await ensureAdminTable();
  const id = await getSessionAdminId();
  if (!id) throw new Error("Unauthorized");
  const [admin] = await db.select().from(admins).where(eq(admins.id, id)).limit(1);
  if (!admin) throw new Error("Unauthorized");
  return admin;
}
