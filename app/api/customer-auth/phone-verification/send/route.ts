import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
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
import { setCustomerPhoneVerifyCookie } from "@/lib/auth/customerPhoneVerifyContext";
import { normalizePhone } from "@/lib/supplierSignup/validators";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";

interface SendPhoneVerifyOtpBody {
  phone?: string;
}

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try again in 2 minutes or use Email OTP.";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = readSupabaseSessionFromRequest(req);
    if (!session?.userId) {
      return apiError(req, 401, "unauthorized", "Login is required.");
    }

    const profile = await getIdentityProfileByUserId(session.userId);
    const role = profile?.role || session.role || "customer";
    if (role !== "customer") {
      return apiError(req, 403, "forbidden", "Only customer accounts can verify mobile here.");
    }

    const body = (await req.json().catch(() => ({}))) as SendPhoneVerifyOtpBody;
    const phone = normalizePhone(body.phone);
    if (!phone) {
      return apiError(req, 400, "invalid_phone", "Enter a valid mobile number.");
    }

    let provider: "supabase_phone" | "twilio_verify" = "supabase_phone";
    try {
      await sendPhoneOtp({ phone });
    } catch (supabaseError) {
      const canUseTwilioFallback = isTwilioVerifyConfigured();
      safeLog(
        "auth.customer.phone.verify.send.fallback_attempt",
        {
          requestId,
          route: "/api/customer-auth/phone-verification/send",
          hasTwilioFallback: canUseTwilioFallback,
          reason:
            supabaseError instanceof SupabaseAuthUnavailableError
              ? "supabase_auth_not_configured"
              : supabaseError instanceof SupabaseAuthRequestError
                ? supabaseError.code || "otp_send_failed"
                : "otp_send_failed",
        },
        req
      );
      if (!canUseTwilioFallback) throw supabaseError;
      await sendOtpWithTwilio(phone);
      provider = "twilio_verify";
    }

    const response = apiSuccess(req, {
      sent: true,
      provider,
      phone_suffix: phone.slice(-4),
    });
    setCustomerPhoneVerifyCookie(response, {
      userId: session.userId,
      phone,
      provider,
    });
    response.headers.set("x-request-id", requestId);

    safeLog(
      "auth.customer.phone.verify.send.success",
      {
        requestId,
        route: "/api/customer-auth/phone-verification/send",
        phoneSuffix: phone.slice(-4),
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.phone.verify.send.failed",
      {
        requestId,
        route: "/api/customer-auth/phone-verification/send",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "otp_send_failed"
              : error instanceof TwilioVerifyUnavailableError
                ? "twilio_verify_unavailable"
                : error instanceof TwilioVerifyRequestError
                  ? "twilio_verify_request_failed"
                  : "otp_send_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        OTP_UNAVAILABLE_MESSAGE
      );
    }
    if (error instanceof SupabaseAuthRequestError) {
      const providerDown = error.status === 401 || error.status === 403 || error.status >= 500;
      return apiError(
        req,
        providerDown ? 503 : 400,
        providerDown ? "otp_provider_unavailable" : "otp_send_failed",
        providerDown ? OTP_UNAVAILABLE_MESSAGE : "Failed to send OTP. Please retry."
      );
    }
    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(
        req,
        503,
        "otp_provider_unavailable",
        OTP_UNAVAILABLE_MESSAGE
      );
    }
    if (error instanceof TwilioVerifyRequestError) {
      const providerDown = error.status === 401 || error.status === 403 || error.status >= 500;
      return apiError(
        req,
        providerDown ? 503 : 400,
        providerDown ? "otp_provider_unavailable" : "otp_send_failed",
        providerDown ? OTP_UNAVAILABLE_MESSAGE : "Failed to send OTP. Please retry."
      );
    }
    return apiError(req, 500, "otp_send_failed", "Failed to send OTP.");
  }
}
