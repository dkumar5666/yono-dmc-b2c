"use client";

import { useEffect, useMemo, useState } from "react";
import { Copy, RefreshCw } from "lucide-react";

interface DiagnosticsPayload {
  env: {
    hasGoogleClientId: boolean;
    hasGoogleClientSecret: boolean;
    hasOtpProviderKey: boolean;
    hasCookieSecret: boolean;
  };
  routes: {
    googleStart: string;
    googleCallback: string;
    otpSend: string;
    otpVerify: string;
  };
  cookies: {
    customerSessionCookieName: string;
    googleStateCookieName: string;
    otpChallengeCookieName: string;
  };
}

function StatusBadge({ ok }: { ok: boolean }) {
  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-rose-200 bg-rose-50 text-rose-700",
      ].join(" ")}
    >
      {ok ? "Present" : "Missing"}
    </span>
  );
}

export default function AdminAuthDiagnosticsPage() {
  const [data, setData] = useState<DiagnosticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyMessage, setCopyMessage] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/auth/diagnostics", { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as
        | DiagnosticsPayload
        | { error?: string }
        | null;
      if (!res.ok) {
        throw new Error((json as { error?: string } | null)?.error || "Failed to load diagnostics");
      }
      setData(json as DiagnosticsPayload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load diagnostics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const checklistText = useMemo(
    () =>
      [
        "Auth Diagnostics Checklist",
        "- Verify GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are present",
        "- Verify TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_VERIFY_SERVICE_SID are present",
        "- Verify AUTH_SESSION_SECRET (or NEXTAUTH_SECRET) is present",
        "- Test Google Start and Callback routes",
        "- Test OTP Send and OTP Verify routes",
      ].join("\n"),
    []
  );

  async function copyChecklist() {
    try {
      await navigator.clipboard.writeText(checklistText);
      setCopyMessage("Checklist copied.");
      window.setTimeout(() => setCopyMessage(null), 2000);
    } catch {
      setCopyMessage("Copy failed.");
      window.setTimeout(() => setCopyMessage(null), 2000);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Auth Diagnostics</h1>
          <p className="text-sm text-slate-500">Environment and route readiness for customer sign-in.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void copyChecklist()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <Copy className="h-4 w-4" />
            Copy test checklist
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>
      </div>

      {copyMessage ? (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-700">
          {copyMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Loading diagnostics...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6">
          <p className="text-sm font-medium text-rose-700">{error}</p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-3 rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm font-medium text-rose-700"
          >
            Retry
          </button>
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-1">
            <h2 className="text-base font-semibold text-slate-900">Environment</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span>GOOGLE_CLIENT_ID</span>
                <StatusBadge ok={data.env.hasGoogleClientId} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>GOOGLE_CLIENT_SECRET</span>
                <StatusBadge ok={data.env.hasGoogleClientSecret} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>OTP Provider Keys</span>
                <StatusBadge ok={data.env.hasOtpProviderKey} />
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Cookie Secret</span>
                <StatusBadge ok={data.env.hasCookieSecret} />
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <h2 className="text-base font-semibold text-slate-900">Routes</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.routes.googleStart}</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.routes.googleCallback}</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.routes.otpSend}</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.routes.otpVerify}</div>
            </div>

            <h2 className="mt-6 text-base font-semibold text-slate-900">Cookies</h2>
            <div className="mt-4 grid gap-2 text-sm">
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.cookies.customerSessionCookieName}</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.cookies.googleStateCookieName}</div>
              <div className="rounded-lg bg-slate-50 px-3 py-2 font-mono">{data.cookies.otpChallengeCookieName}</div>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

