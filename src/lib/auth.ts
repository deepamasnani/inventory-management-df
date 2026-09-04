import { cookies } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
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
