"use client";

import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Mail, ShieldCheck } from "lucide-react";

interface ApiErrorShape {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
  };
}

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

function AdminLoginContent() {
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const oauthError = searchParams.get("error");

  const oauthErrorMessage = useMemo(() => {
    if (!oauthError) return null;
    const map: Record<string, string> = {
      role_not_allowed: "This account is not configured as admin.",
      google_state_mismatch: "Google login session expired. Please try again.",
      google_token_exchange_failed: "Google login failed. Please retry.",
      google_auth_failed: "Google login failed. Please retry.",
      supabase_auth_not_configured: "Supabase auth is not configured.",
    };
    return map[oauthError] || "Login failed.";
  }, [oauthError]);

  useEffect(() => {
    if (oauthErrorMessage) {
      setError(oauthErrorMessage);
    }
  }, [oauthErrorMessage]);

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch("/api/auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json()) as { user?: { role?: string } };
        if (payload.user?.role === "admin") {
          window.location.href = "/admin/control-center";
        }
      } catch {
        // ignore
      }
    })();
  }, []);

  async function onGoogleAdminLogin() {
    const query = new URLSearchParams({
      role: "admin",
      next: "/admin/control-center",
    });
    window.location.href = `/api/auth/supabase/google/start?${query.toString()}`;
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const response = await fetch("/api/auth/supabase/password/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          expectedRole: "admin",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape & {
        data?: { role?: string };
      };
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Admin login failed"));
      }
      if (payload.data?.role !== "admin") {
        throw new Error("This account is not configured as admin.");
      }
      window.location.href = "/admin/control-center";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Admin login failed");
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
          <h1 className="text-3xl font-semibold text-slate-900">Admin Sign In</h1>
          <p className="mt-2 text-sm text-slate-600">Official office access for Yono DMC admin staff.</p>

          <button
            type="button"
            onClick={() => void onGoogleAdminLogin()}
            className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-800 hover:bg-slate-50"
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[#199ce0] text-white">
              G
            </span>
            Continue with Google
          </button>

          <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <form onSubmit={onSubmit} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Admin email"
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
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
            >
              <ShieldCheck className="h-4 w-4" />
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {error ? (
            <p className="mt-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          ) : null}

          <div className="mt-6 text-sm">
            <Link href="/login" className="inline-flex items-center gap-2 font-semibold text-[#199ce0]">
              <Mail className="h-4 w-4" />
              Go to customer login
            </Link>
          </div>
          <div className="mt-2 text-sm">
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

export default function AdminLoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <AdminLoginContent />
    </Suspense>
  );
}

