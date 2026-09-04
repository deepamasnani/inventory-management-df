import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "crypto";
import { promisify } from "util";

const scrypt = promisify(scryptCb);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt.toString("hex")}:${buf.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const hash = Buffer.from(hashHex, "hex");
  const buf = (await scrypt(password, salt, 64)) as Buffer;
  if (buf.length !== hash.length) return false;
  return timingSafeEqual(buf, hash);
}

export function normalizePhone(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}
