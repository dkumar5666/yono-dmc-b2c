import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  applyOtpContextCookie,
  normalizeRole,
  sanitizeNextPath,
} from "@/lib/auth/supabaseSession";
import {
  sendPhoneOtp,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import {
  isTwilioVerifyConfigured,
  sendOtpWithTwilio,
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
} from "@/lib/auth/twilioVerifyFallback";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SendOtpBody {
  phone?: string;
  role?: string;
  fullName?: string;
  companyName?: string;
  city?: string;
  next?: string;
}

function normalizePhone(value: string | undefined): string {
  const raw = (value || "").trim();
  if (!raw) return "";
  if (raw.startsWith("+")) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `+${digits}` : "";
}

function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const body = (await req.json().catch(() => ({}))) as SendOtpBody;
    const phone = normalizePhone(body.phone);
    const role = normalizeRole(body.role);
    const nextPath = sanitizeNextPath(body.next);

    safeLog(
      "auth.supabase.otp.send.requested",
      {
        requestId,
        route: "/api/auth/supabase/otp/send",
        hasRoleHint: Boolean(role),
      },
      req
    );

    if (!phone) {
      return apiError(req, 400, "missing_phone", "Phone number is required.");
    }
    if (!isValidE164(phone)) {
      return apiError(
        req,
        400,
        "invalid_phone",
        "Phone number must be in international format, e.g. +9199XXXXXXXX."
      );
    }

    let provider: "supabase_phone" | "twilio_verify" = "supabase_phone";
    let challengeId: string | undefined;

    try {
      await sendPhoneOtp({ phone });
    } catch (supabaseError) {
      const canUseTwilioFallback = isTwilioVerifyConfigured();
      safeLog(
        "auth.supabase.otp.send.fallback_attempt",
        {
          requestId,
          route: "/api/auth/supabase/otp/send",
          hasTwilioFallback: canUseTwilioFallback,
          supabaseReason:
            supabaseError instanceof SupabaseAuthUnavailableError
              ? "supabase_auth_not_configured"
              : supabaseError instanceof SupabaseAuthRequestError
                ? supabaseError.code || "otp_send_failed"
                : "otp_send_failed",
        },
        req
      );

      if (!canUseTwilioFallback) {
        throw supabaseError;
      }

      try {
        const twilioResult = await sendOtpWithTwilio(phone);
        provider = "twilio_verify";
        challengeId = twilioResult.challengeId;
      } catch (twilioError) {
        if (
          twilioError instanceof TwilioVerifyUnavailableError ||
          twilioError instanceof TwilioVerifyRequestError
        ) {
          throw twilioError;
        }
        throw supabaseError;
      }
    }

    const response = apiSuccess(req, { sent: true });
    response.headers.set("x-request-id", requestId);
    applyOtpContextCookie(response, {
      phone,
      role,
      fullName: body.fullName?.trim() || undefined,
      companyName: body.companyName?.trim() || undefined,
      city: body.city?.trim() || undefined,
      nextPath,
      provider,
      challengeId,
    });

    safeLog(
      "auth.supabase.otp.send.success",
      {
        requestId,
        route: "/api/auth/supabase/otp/send",
        outcome: "success",
        provider,
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.supabase.otp.send.failed",
      {
        requestId,
        route: "/api/auth/supabase/otp/send",
        outcome: "fail",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "otp_send_failed"
              : "otp_send_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "supabase_auth_not_configured",
        "Supabase Auth is not configured."
      );
    }

    if (error instanceof SupabaseAuthRequestError) {
      const mappedCode =
        error.status === 400 || error.status === 422
          ? "otp_provider_unavailable"
          : "otp_send_failed";
      return apiError(req, error.status >= 500 ? 502 : 400, mappedCode, error.message);
    }

    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(req, 503, "otp_provider_unavailable", error.message);
    }

    if (error instanceof TwilioVerifyRequestError) {
      const code = error.status === 400 || error.status === 404 ? "otp_send_failed" : "otp_provider_unavailable";
      return apiError(req, error.status >= 500 ? 502 : 400, code, error.message);
    }

    return apiError(req, 500, "otp_send_failed", "Failed to send OTP.");
  }
}
