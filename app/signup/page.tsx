"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Phone } from "lucide-react";

interface ApiErrorShape {
  ok?: false;
  error?: {
    code?: string;
    message?: string;
  };
}

interface MeShape {
  data?: {
    user?: {
      email?: string;
      phone?: string;
    };
    profile_completed?: boolean;
  };
}

type SignupStep = "identity" | "email_verify" | "mobile_verify" | "set_password";

function readErrorMessage(payload: unknown, fallback: string): string {
  const row = payload as ApiErrorShape | null;
  return row?.error?.message || fallback;
}

function SignupContent() {
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/account/onboarding";
  const roleHint = searchParams.get("role");

  const [step, setStep] = useState<SignupStep>("identity");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [emailOtp, setEmailOtp] = useState("");
  const [mobileOtp, setMobileOtp] = useState("");
  const [mobileSent, setMobileSent] = useState(false);
  const [countdown, setCountdown] = useState(0);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = window.setInterval(() => {
      setCountdown((value) => (value > 0 ? value - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    if (roleHint === "agent") {
      const next = encodeURIComponent(nextPath || "/agent/dashboard");
      window.location.replace(`/agent/signup?next=${next}`);
      return;
    }
    void (async () => {
      try {
        const response = await fetch("/api/customer-auth/me", { cache: "no-store" });
        if (!response.ok) return;
        const payload = (await response.json().catch(() => ({}))) as MeShape;

        if (payload?.data?.profile_completed) {
          window.location.href = "/account";
          return;
        }

        const meEmail = payload?.data?.user?.email || "";
        const mePhone = payload?.data?.user?.phone || "";
        if (meEmail) {
          setEmail(meEmail);
          setStep("mobile_verify");
        }
        if (mePhone) {
          setPhone(mePhone);
          setStep("set_password");
        }
      } catch {
        // ignore
      }
    })();
  }, [nextPath, roleHint]);

  async function sendEmailOtp() {
    const response = await fetch("/api/auth/supabase/email-otp/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        next: "/signup",
        intent: "signup",
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Failed to send email OTP"));
    }
    setStep("email_verify");
    setCountdown(60);
    setMessage("Email OTP sent successfully.");
  }

  async function onStartSignup(e: FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!phone.trim()) {
      setError("Mobile number is required.");
      return;
    }

    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendEmailOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email OTP");
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
        body: JSON.stringify({
          email,
          token: emailOtp,
          next: "/signup",
          intent: "signup",
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Email OTP verification failed"));
      }
      setStep("mobile_verify");
      setMessage("Email verified. Now verify your mobile number.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Email OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onResendEmailOtp() {
    if (countdown > 0 || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendEmailOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend email OTP");
    } finally {
      setLoading(false);
    }
  }

  async function sendMobileOtp() {
    const response = await fetch("/api/customer-auth/phone-verification/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
    if (!response.ok) {
      throw new Error(readErrorMessage(payload, "Failed to send mobile OTP"));
    }
    setMobileSent(true);
    setCountdown(60);
    setMessage("Mobile OTP sent successfully.");
  }

  async function onSendMobileOtp(e: FormEvent) {
    e.preventDefault();
    if (!phone.trim()) {
      setError("Mobile number is required.");
      return;
    }
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendMobileOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send mobile OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onResendMobileOtp() {
    if (countdown > 0 || loading) return;
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      await sendMobileOtp();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend mobile OTP");
    } finally {
      setLoading(false);
    }
  }

  async function onVerifyMobileOtp(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const response = await fetch("/api/customer-auth/phone-verification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, otp: mobileOtp }),
      });
      const payload = (await response.json().catch(() => ({}))) as ApiErrorShape;
      if (!response.ok) {
        throw new Error(readErrorMessage(payload, "Mobile OTP verification failed"));
      }
      setStep("set_password");
      setMessage("Mobile verified. Set your password to finish account setup.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Mobile OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const passwordResponse = await fetch("/api/auth/supabase/password/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password, confirmPassword }),
      });
      const passwordPayload = (await passwordResponse.json().catch(() => ({}))) as ApiErrorShape;
      if (!passwordResponse.ok) {
        throw new Error(readErrorMessage(passwordPayload, "Failed to set password"));
      }

      await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone || null,
          phone_verified: true,
          profile_completed: false,
        }),
      });

      setMessage("Account created successfully.");
      window.location.href = nextPath || "/account/onboarding";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete signup");
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
          <h1 className="text-3xl font-semibold text-slate-900">Create account</h1>
          <p className="mt-2 text-sm text-slate-600">
            First-time signup requires Email OTP, Mobile OTP, and password setup. You can complete profile details after login.
          </p>

          {step === "identity" ? (
            <form onSubmit={onStartSignup} className="mt-5 space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number (+91...)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Continue"}
              </button>
            </form>
          ) : null}

          {step === "email_verify" ? (
            <form onSubmit={onVerifyEmailOtp} className="mt-5 space-y-3">
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-slate-600"
              />
              <input
                type="text"
                required
                value={emailOtp}
                onChange={(e) => setEmailOtp(e.target.value)}
                placeholder="6-digit Email OTP"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Verify Email OTP"}
              </button>
              {countdown > 0 ? (
                <p className="text-center text-sm text-slate-600">Resend OTP in {countdown}s</p>
              ) : (
                <button
                  type="button"
                  onClick={() => void onResendEmailOtp()}
                  disabled={loading}
                  className="w-full text-sm font-semibold text-[#199ce0] hover:underline disabled:opacity-60"
                >
                  Resend Email OTP
                </button>
              )}
            </form>
          ) : null}

          {step === "mobile_verify" ? (
            <form onSubmit={mobileSent ? onVerifyMobileOtp : onSendMobileOtp} className="mt-5 space-y-3">
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Mobile number (+91...)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              {mobileSent ? (
                <input
                  type="text"
                  required
                  value={mobileOtp}
                  onChange={(e) => setMobileOtp(e.target.value)}
                  placeholder="6-digit Mobile OTP"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
                />
              ) : null}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                <Phone className="h-4 w-4" />
                {loading ? "Please wait..." : mobileSent ? "Verify Mobile OTP" : "Send Mobile OTP"}
              </button>
              {mobileSent ? (
                countdown > 0 ? (
                  <p className="text-center text-sm text-slate-600">Resend OTP in {countdown}s</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => void onResendMobileOtp()}
                    disabled={loading}
                    className="w-full text-sm font-semibold text-[#199ce0] hover:underline disabled:opacity-60"
                  >
                    Resend Mobile OTP
                  </button>
                )
              ) : null}
            </form>
          ) : null}

          {step === "set_password" ? (
            <form onSubmit={onSetPassword} className="mt-5 space-y-3">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:border-[#199ce0] focus:ring-2 focus:ring-[#199ce0]/20"
              />
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#199ce0] px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Create account"}
              </button>
              <p className="text-xs text-slate-500">
                Password must be at least 8 characters with uppercase, lowercase, and a number.
              </p>
            </form>
          ) : null}

          <div className="mt-5 text-sm">
            <Link href={`/login?next=${encodeURIComponent(nextPath)}`} className="font-semibold text-[#199ce0]">
              Already have an account? Sign in
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

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50" />}>
      <SignupContent />
    </Suspense>
  );
}
