import { createHash, randomInt } from "crypto";

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function generateOtp(): string {
  return String(randomInt(100000, 1000000));
}

export function hashOtp(code: string): string {
  const secret = process.env.AUTH_SECRET || "dev-footwear-local-auth-secret-change-me";
  return createHash("sha256").update(`${code}:${secret}`).digest("hex");
}

export function verifyOtp(code: string, storedHash: string): boolean {
  return hashOtp(code) === storedHash;
}

type SendOtpResult =
  | { ok: true; devMode?: boolean; devOtp?: string }
  | { error: string };

export async function sendPasswordResetOtpEmail(
  to: string,
  code: string
): Promise<SendOtpResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || "Dev Footwear <onboarding@resend.dev>";

  if (!apiKey) {
    console.log(`[dev-footwear] Password reset OTP for ${to}: ${code}`);
    return { ok: true, devMode: true, devOtp: code };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: "Dev Footwear — password reset code",
      html: `
        <div style="font-family:Inter,sans-serif;line-height:1.6;color:#1e293b">
          <h2 style="margin:0 0 12px">Password reset</h2>
          <p>Use this one-time code to reset your Dev Footwear admin password:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;margin:16px 0">${code}</p>
          <p style="color:#64748b;font-size:14px">This code expires in 10 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[dev-footwear] Email send failed:", body);
    return { error: "Could not send email. Check email settings and try again." };
  }

  return { ok: true };
}
