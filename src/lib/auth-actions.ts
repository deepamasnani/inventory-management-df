"use server";

import { eq, and, gt, desc } from "drizzle-orm";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { admins, passwordResetOtps } from "@/db/schema";
import {
  clearSessionCookie,
  ensureDefaultAdmin,
  requireAdmin,
  setSessionCookie,
} from "./auth";
import { hashPassword, verifyPassword } from "./password";
import {
  generateOtp,
  hashOtp,
  isValidEmail,
  normalizeEmail,
  sendPasswordResetOtpEmail,
  verifyOtp,
} from "./email";

const OTP_TTL_MS = 10 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000;

function validatePassword(password: string): string | null {
  if (password.length < 6) return "Password must be at least 6 characters";
  return null;
}

export async function loginAdmin(username: string, password: string) {
  await ensureDefaultAdmin();
  const name = username.trim().toLowerCase();
  const [admin] = await db.select().from(admins).where(eq(admins.username, name)).limit(1);
  if (!admin || !(await verifyPassword(password, admin.passwordHash))) {
    return { error: "Invalid username or password" };
  }
  await setSessionCookie(admin.id);
  redirect("/");
}

export async function logoutAdmin() {
  await clearSessionCookie();
  redirect("/login");
}

export async function sendPasswordResetOtp(email: string) {
  await ensureDefaultAdmin();
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { error: "Enter a valid email address" };
  }

  const [admin] = await db.select().from(admins).where(eq(admins.email, normalized)).limit(1);
  if (!admin) {
    return { error: "No admin account is registered with this email" };
  }

  const [recent] = await db
    .select()
    .from(passwordResetOtps)
    .where(eq(passwordResetOtps.email, normalized))
    .orderBy(desc(passwordResetOtps.createdAt))
    .limit(1);

  if (recent?.createdAt && Date.now() - recent.createdAt.getTime() < OTP_RESEND_MS) {
    return { error: "Please wait a minute before requesting another code" };
  }

  const code = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await db.insert(passwordResetOtps).values({
    email: normalized,
    codeHash: hashOtp(code),
    expiresAt,
  });

  const sent = await sendPasswordResetOtpEmail(normalized, code);
  if ("error" in sent) return sent;

  return {
    ok: true as const,
    devMode: sent.devMode,
    devOtp: sent.devOtp,
  };
}

export async function resetPasswordWithOtp(
  email: string,
  otp: string,
  newPassword: string,
  confirmPassword: string
) {
  await ensureDefaultAdmin();
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { error: "Enter a valid email address" };
  }
  const cleanOtp = otp.trim();
  if (!/^\d{6}$/.test(cleanOtp)) {
    return { error: "Enter the 6-digit code from your email" };
  }

  const pwdError = validatePassword(newPassword);
  if (pwdError) return { error: pwdError };
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match" };
  }

  const [admin] = await db.select().from(admins).where(eq(admins.email, normalized)).limit(1);
  if (!admin) {
    return { error: "No admin account is registered with this email" };
  }

  const [otpRow] = await db
    .select()
    .from(passwordResetOtps)
    .where(
      and(
        eq(passwordResetOtps.email, normalized),
        gt(passwordResetOtps.expiresAt, new Date())
      )
    )
    .orderBy(desc(passwordResetOtps.createdAt))
    .limit(1);

  if (!otpRow || !verifyOtp(cleanOtp, otpRow.codeHash)) {
    return { error: "Invalid or expired code" };
  }

  await db
    .update(admins)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(admins.id, admin.id));

  await db.delete(passwordResetOtps).where(eq(passwordResetOtps.email, normalized));

  await setSessionCookie(admin.id);
  redirect("/");
}

export async function getAdminProfile() {
  const admin = await requireAdmin();
  return {
    username: admin.username,
    email: admin.email,
  };
}

export async function changeAdminPassword(
  currentPassword: string,
  newPassword: string,
  confirmPassword: string
) {
  const admin = await requireAdmin();
  if (!(await verifyPassword(currentPassword, admin.passwordHash))) {
    return { error: "Current password is incorrect" };
  }
  const pwdError = validatePassword(newPassword);
  if (pwdError) return { error: pwdError };
  if (newPassword !== confirmPassword) {
    return { error: "New passwords do not match" };
  }
  if (currentPassword === newPassword) {
    return { error: "New password must be different from the current password" };
  }

  await db
    .update(admins)
    .set({ passwordHash: await hashPassword(newPassword) })
    .where(eq(admins.id, admin.id));

  revalidatePath("/");
  return { ok: true as const };
}

export async function updateAdminEmail(email: string, password: string) {
  const admin = await requireAdmin();
  if (!(await verifyPassword(password, admin.passwordHash))) {
    return { error: "Password is incorrect" };
  }
  const normalized = normalizeEmail(email);
  if (!isValidEmail(normalized)) {
    return { error: "Enter a valid email address" };
  }

  await db.update(admins).set({ email: normalized }).where(eq(admins.id, admin.id));
  revalidatePath("/");
  return { ok: true as const, email: normalized };
}
