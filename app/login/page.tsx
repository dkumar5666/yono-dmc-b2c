"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, Smartphone } from "lucide-react";

interface ApiErrorShape {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
  };
}

interface OtpVerifySuccess {
  ok?: true;
  data?: {
    verified?: boolean;
    role?: string;
    nextPath?: string;
  };
}

interface PasswordLoginSuccess {
  ok?: true;
  data?: {
    loggedIn?: boolean;
    role?: string;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/my-trips";
  const oauthError = searchParams.get("error");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oauthErrorMessage = useMemo(() => {
    if (!oauthError) return null;
    const map: Record<string, string> = {
      google_state_mismatch: "Google login session expired. Please try again.",
      google_missing_code: "Google callback did not include a code.",
      google_provider_error: "Google login was cancelled or failed.",
      google_token_exchange_failed: "Google token exchange failed. Please retry.",
      google_auth_failed: "Google login failed. Please retry.",
      supabase_auth_not_configured: "Supabase Auth is not configured yet.",
    };
    return map[oauthError] || "Login failed. Please try again.";
  }, [oauthError]);

  useEffect(() => {
    if (!oauthErrorMessage) return;
    setError(oauthErrorMessage);
  }, [oauthErrorMessage]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (response.ok) {
          window.location.href = nextPath;
        }
      } catch {
        // no-op
      }
    })();
  }, [nextPath]);

  async function onGoogleLogin() {
    setError(null);
    setMessage(null);
    const query = new URLSearchParams({
      next: nextPath,
    });
    window.location.href = `/api/auth/supabase/google/start?${query.toString()}`;
  }

  async function onSendOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          next: nextPath,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Failed to send OTP"));
      }
      setOtpSent(true);
      setMessage("OTP sent. Enter the verification code.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          token: otp,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpVerifySuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "OTP verification failed"));
      }
      const next = payload.data?.nextPath || nextPath || "/my-trips";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onPasswordLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as PasswordLoginSuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Login failed"));
      }
      const role = payload.data?.role || "customer";
      if (role === "admin") {
        window.location.href = "/admin/control-center";
        return;
      }
      if (role === "supplier") {
        window.location.href = "/supplier/dashboard";
        return;
      }
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-10">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Link href="/" aria-label="Yono DMC home">
            <Image src="/logo.png" alt="Yono DMC" width={190} height={58} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h1 className="text-3xl font-semibold text-slate-900">Sign in</h1>
          <p className="mt-2 text-sm text-slate-600">
            Login with Google or mobile OTP. Office and supplier users can use email/password.
          </p>

          <button
            type="button"
            onClick={() => void onGoogleLogin()}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-white font-bold text-[#199ce0]">
              G
            </span>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={otpSent ? onVerifyOtp : onSendOtp} className="space-y-3">
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Mobile number (+91...)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
            />
            {otpSent ? (
              <input
                type="text"
                required
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="6-digit OTP"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
            ) : null}
            <button
              type="submit"
              disabled={loading}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <Smartphone className="h-4 w-4" />
              {loading ? "Please wait..." : otpSent ? "Verify OTP" : "Send OTP"}
            </button>
          </form>

          <div className="mt-6 border-t border-slate-200 pt-5">
            <p className="mb-2 text-sm font-semibold text-slate-700">Office / Supplier login</p>
            <form onSubmit={onPasswordLogin} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
              >
                <Mail className="h-4 w-4" />
                Sign in with email
              </button>
            </form>
          </div>

          <div className="mt-5 space-y-2 text-sm">
            <Link href={`/signup?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#199ce0]">
              New here? Create an account
            </Link>
            <Link href="/agent/login" className="block font-semibold text-[#199ce0]">
              B2B Agent Login
            </Link>
            <Link href="/admin/login" className="block font-semibold text-[#199ce0]">
              Office Admin Login
            </Link>
          </div>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}

          <div className="mt-6 text-sm">
            <Link href="/" className="inline-flex items-center gap-2 font-semibold text-[#199ce0]">
              <ArrowLeft className="h-4 w-4" />
              Back to website
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <LoginContent />
    </Suspense>
  );
}
