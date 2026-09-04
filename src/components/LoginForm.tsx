"use client";

import { FormEvent, useEffect, useState, useTransition } from "react";
import { Lock, Mail, Shield } from "lucide-react";
import {
  loginAdmin,
  resetPasswordWithOtp,
  sendPasswordResetOtp,
} from "@/lib/auth-actions";
import { Label } from "./ui/Card";

export default function LoginForm() {
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [resetStep, setResetStep] = useState<"email" | "otp">("email");
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const saved = window.localStorage.getItem("dev-footwear-theme");
    const isDark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  function onLogin(e: FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginAdmin(username, password);
      if (result?.error) setError(result.error);
    });
  }

  function onSendOtp(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setDevOtp("");
    startTransition(async () => {
      const result = await sendPasswordResetOtp(email);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setResetStep("otp");
      if (result.devMode && result.devOtp) {
        setDevOtp(result.devOtp);
        setInfo("Email is not configured — use the dev code below.");
      } else {
        setInfo("We sent a 6-digit code to your email.");
      }
    });
  }

  function onReset(e: FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await resetPasswordWithOtp(email, otp, newPassword, confirmPassword);
      if (result?.error) setError(result.error);
    });
  }

  function switchMode(next: "login" | "reset") {
    setMode(next);
    setResetStep("email");
    setError("");
    setInfo("");
    setDevOtp("");
    setOtp("");
    setNewPassword("");
    setConfirmPassword("");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div
        className="w-full max-w-[420px] rounded-[28px] p-7"
        style={{ background: "var(--app-shell-bg)", boxShadow: "var(--app-shell-shadow)" }}
      >
        <div className="flex items-center gap-2.5 mb-6">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{
              background: "linear-gradient(145deg, #0F766E 0%, #14B8A6 100%)",
              boxShadow: "0 3px 10px rgba(15, 118, 110, 0.3)",
            }}
          >
            <span className="text-[#ecfdf8] font-bold text-sm">D</span>
          </div>
          <div>
            <div className="font-bold text-[16px] themed-title">Dev Footwear</div>
            <div className="text-[11px] themed-muted">Admin sign in</div>
          </div>
        </div>

        <div
          className="flex rounded-2xl p-1 mb-5"
          style={{ background: "var(--surface-soft)" }}
        >
          <button
            type="button"
            className="flex-1 text-xs font-semibold py-2 rounded-xl border-none"
            style={
              mode === "login"
                ? { background: "var(--surface)", color: "var(--accent)" }
                : { background: "transparent", color: "var(--text-muted)" }
            }
            onClick={() => switchMode("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className="flex-1 text-xs font-semibold py-2 rounded-xl border-none"
            style={
              mode === "reset"
                ? { background: "var(--surface)", color: "var(--accent)" }
                : { background: "transparent", color: "var(--text-muted)" }
            }
            onClick={() => switchMode("reset")}
          >
            Reset password
          </button>
        </div>

        {error && (
          <div
            className="text-xs font-medium rounded-xl px-3 py-2.5 mb-3"
            style={{
              background: "color-mix(in srgb, #E05A5A 16%, var(--surface))",
              color: "#E05A5A",
            }}
          >
            {error}
          </div>
        )}

        {info && (
          <div
            className="text-xs font-medium rounded-xl px-3 py-2.5 mb-3"
            style={{
              background: "color-mix(in srgb, var(--accent) 16%, var(--surface))",
              color: "var(--accent)",
            }}
          >
            {info}
            {devOtp && (
              <div className="mt-2 font-mono text-lg tracking-[0.3em]">{devOtp}</div>
            )}
          </div>
        )}

        {mode === "login" ? (
          <form onSubmit={onLogin} className="space-y-3">
            <div>
              <Label>Username</Label>
              <div className="relative">
                <Shield size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none" />
                <input
                  className="field field-search"
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
            </div>
            <div>
              <Label>Password</Label>
              <div className="relative">
                <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none" />
                <input
                  className="field field-search"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary w-full mt-2" type="submit" disabled={pending}>
              {pending ? "Signing in…" : "Sign in"}
            </button>
          </form>
        ) : resetStep === "email" ? (
          <form onSubmit={onSendOtp} className="space-y-3">
            <p className="text-xs themed-muted mb-1">
              Enter the email registered for this admin account. We&apos;ll send a one-time code.
            </p>
            <div>
              <Label>Registered email</Label>
              <div className="relative">
                <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 themed-muted pointer-events-none" />
                <input
                  className="field field-search"
                  type="email"
                  autoComplete="email"
                  placeholder="admin@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <button className="btn btn-primary w-full mt-2" type="submit" disabled={pending}>
              {pending ? "Sending…" : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={onReset} className="space-y-3">
            <p className="text-xs themed-muted mb-1">
              Enter the 6-digit code sent to <span className="font-semibold">{email}</span>.
            </p>
            <div>
              <Label>One-time code</Label>
              <input
                className="field font-mono text-center tracking-[0.3em]"
                inputMode="numeric"
                maxLength={6}
                placeholder="000000"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                required
              />
            </div>
            <div>
              <Label>New password</Label>
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Confirm new password</Label>
              <input
                className="field"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn flex-1"
                onClick={() => {
                  setResetStep("email");
                  setInfo("");
                  setDevOtp("");
                  setOtp("");
                }}
              >
                Back
              </button>
              <button className="btn btn-primary flex-1" type="submit" disabled={pending}>
                {pending ? "Updating…" : "Reset password"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
