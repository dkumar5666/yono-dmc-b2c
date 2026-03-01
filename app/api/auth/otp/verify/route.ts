import {
  applyCustomerSessionCookie,
  createCustomerSessionToken,
} from "@/lib/backend/customerAuth";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { getClientIp } from "@/lib/backend/rateLimit";
import { upsertCustomer } from "@/lib/backend/customerStore";
import {
  checkOtpVerifyGuards,
  isValidOtpCode,
  logOtpRequest,
  normalizePhoneE164,
} from "@/lib/auth/otpAbuse";
import { ensureIdentityProfile } from "@/lib/auth/identityProfiles";
import { applySupabaseSessionCookie, sanitizeNextPath } from "@/lib/auth/supabaseSession";
import { createPasswordSessionForVerifiedPhone } from "@/lib/auth/supabaseAuthProvider";
import { upsertCustomerProfile } from "@/lib/backend/customerAccount";
import {
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
  verifyOtpWithTwilio,
} from "@/lib/auth/twilioVerifyFallback";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface VerifyOtpBody {
  phone?: string;
  country?: string;
  code?: string;
  next?: string;
  full_name?: string;
}

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try again in 2 minutes or use Email OTP.";

function safeUserAgent(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 240);
}

function fallbackName(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  return text || "Customer";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const ip = getClientIp(req);
  const userAgent = safeUserAgent(req);
  let normalizedPhone = "";

  try {
    const body = (await req.json().catch(() => ({}))) as VerifyOtpBody;
    const phone = normalizePhoneE164(body.phone || "", body.country);
    normalizedPhone = phone;
    const code = (body.code || "").trim();
    const fullName = fallbackName(body.full_name);
    const nextPath = sanitizeNextPath(body.next || "/account");

    safeLog(
      "auth.otp.verify.requested",
      {
        requestId,
        route: "/api/auth/otp/verify",
        hasPhone: Boolean(phone),
      },
      req
    );

    if (!phone) {
      return apiError(
        req,
        400,
        "INVALID_PHONE",
        "Phone number is invalid. Use +countrycode format or a valid India mobile number."
      );
    }
    if (!isValidOtpCode(code)) {
      return apiError(req, 400, "INVALID_CODE", "OTP code must be 4-8 digits.");
    }

    const guard = await checkOtpVerifyGuards({ phoneE164: phone, ip });
    if (!guard.ok) {
      await logOtpRequest({
        phoneE164: phone,
        ip,
        userAgent,
        status: "blocked",
        meta: {
          code: "RATE_LIMITED",
          retryAfter: guard.retryAfter,
        },
      });
      const response = apiError(req, 429, "RATE_LIMITED", "Too many attempts. Try again later.", {
        retryAfter: guard.retryAfter,
      });
      response.headers.set("retry-after", String(guard.retryAfter));
      return response;
    }

    const verify = await verifyOtpWithTwilio({ phone, token: code });
    if (!verify.approved) {
      await logOtpRequest({
        phoneE164: phone,
        ip,
        userAgent,
        status: "failed",
        meta: {
          reason: "invalid_code",
          challengeId: verify.challengeId || null,
        },
      });
      return apiError(req, 401, "INVALID_CODE", "Invalid OTP. Please try again.");
    }

    const customer = upsertCustomer({
      provider: "mobile_otp",
      providerUserId: phone,
      phone,
      fullName,
    });
    const customerSessionToken = createCustomerSessionToken({
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: "mobile_otp",
    });

    // Best effort: align OTP users with Supabase identity/profile tables for unified ops data.
    let supabaseSession:
      | {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          expires_at?: number;
          token_type?: string;
          user?: { id?: string; email?: string; phone?: string };
        }
      | undefined;
    let supabaseUserId: string | undefined;
    try {
      supabaseSession = await createPasswordSessionForVerifiedPhone({ phone, fullName });
      supabaseUserId = supabaseSession.user?.id?.trim() || undefined;
      if (supabaseUserId) {
        const profile = await ensureIdentityProfile({
          userId: supabaseUserId,
          role: "customer",
          fullName,
          phone,
          email: supabaseSession.user?.email,
          trustedRoleAssignment: true,
        });
        await upsertCustomerProfile(supabaseUserId, {
          phone,
          phone_verified: true,
          full_name: fullName,
          email: supabaseSession.user?.email || profile?.email || undefined,
        });
      }
    } catch {
      // Keep login successful even if Supabase profile sync is unavailable.
    }

    await logOtpRequest({
      phoneE164: phone,
      ip,
      userAgent,
      status: "verified",
      meta: {
        provider: "twilio",
      },
    });

    const response = apiSuccess(req, {
      redirectTo: nextPath || "/account",
    });
    applyCustomerSessionCookie(response, customerSessionToken);
    if (supabaseSession?.access_token && supabaseUserId) {
      applySupabaseSessionCookie(response, supabaseSession, {
        userId: supabaseUserId,
        email: supabaseSession.user?.email || undefined,
        phone: supabaseSession.user?.phone || phone,
        fullName,
        role: "customer",
      });
    }

    safeLog(
      "auth.otp.verify.success",
      {
        requestId,
        route: "/api/auth/otp/verify",
        outcome: "success",
        supabaseLinked: Boolean(supabaseUserId),
      },
      req
    );
    return response;
  } catch (error) {
    if (normalizedPhone) {
      await logOtpRequest({
        phoneE164: normalizedPhone,
        ip,
        userAgent,
        status: "failed",
        meta: {
          reason:
            error instanceof TwilioVerifyUnavailableError
              ? "otp_provider_unavailable"
              : error instanceof TwilioVerifyRequestError
                ? error.code || "otp_verify_failed"
                : "otp_verify_failed",
          status: error instanceof TwilioVerifyRequestError ? error.status : undefined,
        },
      });
    }

    safeLog(
      "auth.otp.verify.failed",
      {
        requestId,
        route: "/api/auth/otp/verify",
        outcome: "fail",
        reason:
          error instanceof TwilioVerifyUnavailableError
            ? "otp_provider_unavailable"
            : error instanceof TwilioVerifyRequestError
              ? error.code || "otp_verify_failed"
              : "otp_verify_failed",
      },
      req
    );

    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(req, 503, "OTP_PROVIDER_UNAVAILABLE", OTP_UNAVAILABLE_MESSAGE);
    }

    if (error instanceof TwilioVerifyRequestError) {
      if (error.status === 400 || error.status === 404) {
        return apiError(req, 401, "INVALID_CODE", "Invalid OTP. Please try again.");
      }
      const code = error.status === 429 ? "RATE_LIMITED" : "OTP_PROVIDER_UNAVAILABLE";
      return apiError(
        req,
        error.status === 429 ? 429 : error.status >= 500 ? 502 : 503,
        code,
        code === "RATE_LIMITED"
          ? "Too many attempts. Try again later."
          : OTP_UNAVAILABLE_MESSAGE
      );
    }

    return apiError(req, 500, "OTP_VERIFY_FAILED", "Failed to verify OTP. Please retry.");
  }
}
