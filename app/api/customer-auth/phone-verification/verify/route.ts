import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest, applySupabaseSessionCookie } from "@/lib/auth/supabaseSession";
import {
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
  verifyPhoneOtp,
} from "@/lib/auth/supabaseAuthProvider";
import {
  verifyOtpWithTwilio,
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
} from "@/lib/auth/twilioVerifyFallback";
import {
  clearCustomerPhoneVerifyCookie,
  readCustomerPhoneVerifyFromRequest,
} from "@/lib/auth/customerPhoneVerifyContext";
import { normalizePhone } from "@/lib/supplierSignup/validators";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface VerifyPhoneOtpBody {
  phone?: string;
  otp?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = readSupabaseSessionFromRequest(req);
    if (!session?.userId || !session.accessToken) {
      return apiError(req, 401, "unauthorized", "Login is required.");
    }

    const profile = await getIdentityProfileByUserId(session.userId);
    const role = profile?.role || session.role || "customer";
    if (role !== "customer") {
      return apiError(req, 403, "forbidden", "Only customer accounts can verify mobile here.");
    }

    const context = readCustomerPhoneVerifyFromRequest(req);
    if (!context || context.userId !== session.userId) {
      return apiError(req, 400, "verification_context_missing", "Send OTP first.");
    }

    const body = (await req.json().catch(() => ({}))) as VerifyPhoneOtpBody;
    const phone = normalizePhone(body.phone);
    const otp = safeString(body.otp);
    if (!phone || phone !== context.phone) {
      return apiError(req, 400, "verification_context_mismatch", "Mobile number mismatch.");
    }
    if (!otp) {
      return apiError(req, 400, "otp_required", "OTP is required.");
    }

    let sessionUserId = session.userId;
    let sessionRole = role;
    let sessionEmail = session.email || profile?.email || undefined;
    let sessionFullName = session.fullName || profile?.full_name || undefined;
    let sessionAccessToken = session.accessToken;
    let sessionRefreshToken = session.refreshToken;
    let sessionExpiresAt = session.expiresAt;
    let sessionTokenType = session.tokenType;

    if (context.provider === "supabase_phone") {
      const verify = await verifyPhoneOtp({ phone, token: otp });
      const verifiedUserId = safeString(verify.user?.id);
      if (verifiedUserId) {
        sessionUserId = verifiedUserId;
      }

      const verifiedProfile = verifiedUserId ? await getIdentityProfileByUserId(verifiedUserId) : null;
      const verifiedRole = verifiedProfile?.role || sessionRole || "customer";
      if (verifiedRole !== "customer") {
        return apiError(req, 403, "forbidden", "Only customer accounts can verify mobile here.");
      }

      sessionRole = verifiedRole;
      sessionEmail = verify.user?.email || verifiedProfile?.email || sessionEmail;
      sessionFullName = sessionFullName || verifiedProfile?.full_name || undefined;
      sessionAccessToken = verify.access_token || sessionAccessToken;
      sessionRefreshToken = verify.refresh_token || sessionRefreshToken;
      sessionExpiresAt =
        typeof verify.expires_at === "number"
          ? verify.expires_at * 1000
          : Date.now() + Math.max(60, verify.expires_in ?? 3600) * 1000;
      sessionTokenType = verify.token_type || sessionTokenType;
    } else {
      const verify = await verifyOtpWithTwilio({ phone, token: otp });
      if (!verify.approved) {
        return apiError(req, 401, "otp_invalid", "Invalid OTP.");
      }
    }

    const db = new SupabaseRestClient();
    const existingPhoneOwner = await db
      .selectSingle<Record<string, unknown>>(
        "profiles",
        new URLSearchParams({
          select: "id,phone",
          phone: `eq.${phone}`,
          id: `neq.${sessionUserId}`,
        })
      )
      .catch(() => null);
    if (existingPhoneOwner) {
      return apiError(
        req,
        409,
        "phone_already_in_use",
        "This mobile number is already linked with another account."
      );
    }

    const updated = await db
      .updateSingle<Record<string, unknown>>(
        "profiles",
        new URLSearchParams({
          select: "id,role,full_name,email,phone",
          id: `eq.${sessionUserId}`,
        }),
        { phone }
      )
      .catch(() => null);

    if (!updated && !profile) {
      return apiError(req, 503, "profile_unavailable", "Profile update unavailable. Please retry.");
    }

    const response = apiSuccess(req, {
      verified: true,
      phone_suffix: phone.slice(-4),
    });
    applySupabaseSessionCookie(
      response,
      {
        access_token: sessionAccessToken,
        refresh_token: sessionRefreshToken,
        expires_at: Math.floor(sessionExpiresAt / 1000),
        token_type: sessionTokenType,
      },
      {
        userId: sessionUserId,
        role: sessionRole,
        email: sessionEmail,
        phone,
        fullName: sessionFullName,
      }
    );
    clearCustomerPhoneVerifyCookie(response);
    response.headers.set("x-request-id", requestId);

    safeLog(
      "auth.customer.phone.verify.success",
      {
        requestId,
        route: "/api/customer-auth/phone-verification/verify",
        phoneSuffix: phone.slice(-4),
      },
      req
    );

    return response;
  } catch (error) {
    safeLog(
      "auth.customer.phone.verify.failed",
      {
        requestId,
        route: "/api/customer-auth/phone-verification/verify",
        reason:
          error instanceof SupabaseNotConfiguredError
            ? "supabase_not_configured"
            : error instanceof SupabaseAuthUnavailableError
              ? "supabase_auth_not_configured"
              : error instanceof SupabaseAuthRequestError
                ? error.code || "otp_invalid"
                : error instanceof TwilioVerifyUnavailableError
                  ? "twilio_verify_unavailable"
                  : error instanceof TwilioVerifyRequestError
                    ? "twilio_verify_request_failed"
                    : "otp_invalid",
      },
      req
    );

    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(req, 503, "supabase_not_configured", "Service unavailable.");
    }
    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "OTP service temporarily unavailable, please try Google login or retry in 2 minutes."
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        "otp_invalid",
        "Failed to verify OTP."
      );
    }
    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        "OTP service temporarily unavailable, please try Google login or retry in 2 minutes."
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 401,
        "otp_invalid",
        "Failed to verify OTP."
      );
    }
    return apiError(req, 500, "otp_invalid", "Failed to verify OTP.");
  }
}
