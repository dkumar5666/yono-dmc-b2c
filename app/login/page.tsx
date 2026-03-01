"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";

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
    nextPath?: string;
    redirectTo?: string;
  };
}

interface MeSuccessShape {
  ok?: true;
  data?: {
    profile_completed?: boolean;
  };
}

type LoginView = "entry" | "email_verify" | "password";

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

function sanitizeNextPath(nextPath: string | null): string {
  if (!nextPath) return "/my-trips";
  if (!nextPath.startsWith("/")) return "/my-trips";
  if (nextPath.startsWith("//")) return "/my-trips";
  return nextPath;
}

function LoginContent() {
  const searchParams = useSearchParams();
  const nextPath = sanitizeNextPath(searchParams.get("next"));
  const supportWhatsAppUrl =
    process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP_URL?.trim() || "https://wa.me/919958839319";
  const oauthError = searchParams.get("error");

  const [view, setView] = useState<LoginView>("entry");
  const [email, setEmail] = useState("");
  const [emailOtp, setEmailOtp] = useState("");
  const [password, setPassword] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
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
      google_account_not_registered: "This Google account is not registered. Please create an account first.",
      supabase_auth_not_configured: "Supabase Auth is not configured yet.",
    };
    return map[oauthError] || "Login failed. Please try again.";
  }, [oauthError]);

  useEffect(() => {
    if (!oauthErrorMessage) return;
    setError(oauthErrorMessage);
  }, [oauthErrorMessage]);

  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCountdown]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!response.ok) return;

        const payload = (await response.json().catch(() => ({}))) as MeSuccessShape;
        if (!payload?.data?.profile_completed) {
          window.location.href = "/account/onboarding";
          return;
        }
        window.location.href = nextPath;
      } catch {
        // ignore
      }
    })();
  }, [nextPath]);

  async function onGoogleLogin() {
    setError(null);
    setMessage(null);
    const query = new URLSearchParams({ next: nextPath });
    window.location.href = `/api/auth/supabase/google/start?${query.toString()}`;
  }

  async function sendEmailOtpRequest() {
    const response = await fetch("/api/auth/supabase/email-otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next: nextPath, intent: "login" }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Failed to send email OTP"));
    }

    setView("email_verify");
    setResendCountdown(60);
    setMessage("A 6-digit code has been sent to your email.");
  }

  async function onSendEmailOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendEmailOtpRequest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onResendEmailOtp() {
    if (resendCountdown > 0 || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendEmailOtpRequest();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend email OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyEmailOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/supabase/email-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, token: emailOtp, next: nextPath, intent: "login" }),
      });
      const payload = (await response.json().catch(() => ({}))) as OtpVerifySuccess & ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Email OTP verification failed"));
      }

      const next = payload.data?.nextPath || payload.data?.redirectTo || nextPath || "/my-trips";
      window.location.href = next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email OTP verification failed");
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
          expectedRole: "customer",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Invalid email or password."));
      }
      window.location.href = nextPath;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-slate-100">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:py-16">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Link href="/" aria-label="Yono DMC home">
            <Image src="/logo.png" alt="Yono DMC" width={190} height={58} className="h-14 w-auto" priority />
          </Link>
        </div>

        <div className="mx-auto mt-6 max-w-md rounded-2xl border border-slate-200 bg-white p-7 shadow-sm sm:p-8">
          <h1 className="text-[34px] font-semibold tracking-tight text-slate-900">
            {view === "email_verify" ? "Let's confirm your email" : view === "password" ? "Sign in with password" : "Customer Login"}
          </h1>

          <p className="mt-2 text-sm text-slate-600">
            {view === "email_verify"
              ? `Enter the secure code sent to ${email}. Check junk mail if it&apos;s not in your inbox.`
              : view === "password"
                ? "Use your registered email and password to sign in."
                : "Sign in with Google or email OTP to view your trips, payments, and documents."}
          </p>

          {view === "entry" ? (
            <>
              <button
                type="button"
                onClick={() => void onGoogleLogin()}
                className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-lg bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2]"
              >
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-white font-bold text-[#2563d7]">
                  G
                </span>
                Continue with Google
              </button>

              <div className="my-5 flex items-center gap-3 text-sm text-slate-500">
                <span className="h-px flex-1 bg-slate-200" />
                or
                <span className="h-px flex-1 bg-slate-200" />
              </div>

              <form onSubmit={onSendEmailOtp} className="space-y-3">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
                />
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
                >
                  {loading ? "Please wait..." : "Continue with Email OTP"}
                </button>
              </form>

              <button
                type="button"
                onClick={() => setView("password")}
                className="mt-4 w-full text-sm font-semibold text-[#2563d7] hover:underline"
              >
                Sign in with password instead
              </button>

              <Link
                href={`/signup?next=${encodeURIComponent(nextPath)}`}
                className="mt-4 inline-flex w-full items-center justify-center rounded-full border border-[#2563d7] px-4 py-3 text-sm font-semibold text-[#2563d7] hover:bg-[#2563d7]/5"
              >
                Create account
              </Link>
            </>
          ) : null}

          {view === "email_verify" ? (
            <form onSubmit={onVerifyEmailOtp} className="mt-6 space-y-3">
              <input
                type="text"
                required
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="6-digit code"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Continue"}
              </button>
              {resendCountdown > 0 ? (
                <p className="pt-1 text-center text-sm text-slate-600">
                  Didn&apos;t receive a code? You can request another code in {resendCountdown}s
                </p>
              ) : (
                <button
                  type="button"
                  onClick={() => void onResendEmailOtp()}
                  disabled={loading}
                  className="w-full text-sm font-semibold text-[#2563d7] hover:underline disabled:opacity-60"
                >
                  Resend code
                </button>
              )}
              <button
                type="button"
                onClick={() => setView("entry")}
                className="w-full text-sm font-medium text-slate-500 hover:underline"
              >
                Back
              </button>
            </form>
          ) : null}

          {view === "password" ? (
            <form onSubmit={onPasswordLogin} className="mt-6 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full rounded-xl border border-slate-300 px-3 py-2.5 outline-none focus:border-[#2563d7] focus:ring-2 focus:ring-[#2563d7]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-full bg-[#2563d7] px-4 py-3 font-semibold text-white hover:bg-[#1d4fc2] disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Sign in"}
              </button>
              <button
                type="button"
                onClick={() => setView("entry")}
                className="w-full text-sm font-medium text-slate-500 hover:underline"
              >
                Back to email OTP
              </button>
            </form>
          ) : null}

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}
          {message ? (
            <p className="mt-4 rounded-lg border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-700">
              {message}
            </p>
          ) : null}

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
            <p className="font-medium text-slate-800">Need help signing in?</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <a
                href={supportWhatsAppUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold text-[#199ce0] hover:underline"
              >
                Support WhatsApp
              </a>
              <Link href="/support" className="font-semibold text-[#199ce0] hover:underline">
                FAQ & Support
              </Link>
            </div>
          </div>

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
