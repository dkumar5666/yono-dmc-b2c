import {
  applyCustomerSessionCookie,
  clearOtpChallengeCookie,
  createCustomerSessionToken,
  readOtpChallengeFromRequest,
} from "@/lib/backend/customerAuth";
import { upsertCustomer } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import { getTwilioVerifyConfig } from "@/lib/backend/twilioVerifyConfig";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import {
  checkOtpVerifyAllowed,
  markOtpVerifyFailure,
  markOtpVerifySuccess,
} from "@/lib/backend/otpGuard";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface VerifyOtpBody {
  mobile?: string;
  code?: string;
  name?: string;
}

interface TwilioVerifyCheckResponse {
  status?: string;
}

function isValidE164(value: string): boolean {
  return /^\+[1-9]\d{7,14}$/.test(value);
}

function normalizeMobile(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("+")) return trimmed;
  const digits = trimmed.replace(/\D/g, "");
  return `+${digits}`;
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    safeLog(
      "otp.verify.requested",
      {
        requestId,
        route: "/api/customer-auth/otp/verify",
      },
      req
    );

    const ip = getClientIp(req);
    const ipLimit = consumeRateLimit(`otp-verify-ip:${ip}`, 30, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "rate_limited",
        },
        req
      );
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Too many OTP verification attempts. Try again later.",
        { retryAfterSeconds: ipLimit.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set("retry-after", String(ipLimit.retryAfterSeconds));
      return response;
    }

    const twilioConfig = getTwilioVerifyConfig();
    if (!twilioConfig.ok) {
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_provider_unavailable",
        },
        req
      );
      const response = apiError(
        req,
        503,
        "otp_provider_unavailable",
        "OTP provider is unavailable. Please try again later."
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }
    const { accountSid, authToken, verifyServiceSid } = twilioConfig.value;

    const body = (await req.json()) as VerifyOtpBody;
    const to = normalizeMobile(body.mobile ?? "");
    const code = (body.code ?? "").trim();
    const fullName = (body.name ?? "Guest User").trim() || "Guest User";

    if (!to || !code) {
      const response = apiError(
        req,
        400,
        "missing_phone",
        "Mobile number and OTP code are required."
      );
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "missing_phone",
        },
        req
      );
      return response;
    }

    if (!isValidE164(to)) {
      const response = apiError(
        req,
        400,
        "invalid_phone",
        "Mobile number must be in international format, e.g. +9199XXXXXXXX."
      );
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "invalid_phone",
        },
        req
      );
      return response;
    }

    const challenge = readOtpChallengeFromRequest(req);
    if (!challenge) {
      const response = apiError(req, 400, "otp_expired", "OTP challenge has expired. Request a new code.");
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_expired",
        },
        req
      );
      return response;
    }

    if (challenge.phone !== to) {
      const response = apiError(req, 400, "otp_invalid", "OTP challenge does not match mobile number.");
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_challenge_mismatch",
        },
        req
      );
      return response;
    }

    const mobileLimit = consumeRateLimit(`otp-verify-mobile:${to}`, 12, 15 * 60 * 1000);
    if (!mobileLimit.ok) {
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "rate_limited_mobile",
        },
        req
      );
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Too many OTP verification attempts for this number. Try again later.",
        { retryAfterSeconds: mobileLimit.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set("retry-after", String(mobileLimit.retryAfterSeconds));
      return response;
    }

    const verifyAllowed = checkOtpVerifyAllowed(to);
    if (!verifyAllowed.ok) {
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Too many failed attempts. Try again later.",
        { retryAfterSeconds: verifyAllowed.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_temp_blocked",
        },
        req
      );
      return response;
    }

    const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/VerificationCheck`;
    const payload = new URLSearchParams({ To: to, Code: code });
    const authHeader = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

    const twilioRes = await fetch(apiUrl, {
      method: "POST",
      headers: {
        Authorization: `Basic ${authHeader}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: payload.toString(),
      cache: "no-store",
    });

    if (!twilioRes.ok) {
      const twilioText = await twilioRes.text();
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_provider_unavailable",
          twilioStatus: twilioRes.status,
        },
        req
      );
      const response = apiError(
        req,
        502,
        "otp_provider_unavailable",
        "OTP provider verification failed.",
        twilioText
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const verifyResult = (await twilioRes.json()) as TwilioVerifyCheckResponse;
    if (verifyResult.status !== "approved") {
      const failure = markOtpVerifyFailure(to);
      if (failure.blocked) {
        const response = apiError(
          req,
          429,
          "rate_limited",
          "Too many failed attempts. Try again later.",
          { retryAfterSeconds: failure.retryAfterSeconds }
        );
        response.headers.set("x-request-id", requestId);
        safeLog(
          "otp.verify.failed",
          {
            requestId,
            route: "/api/customer-auth/otp/verify",
            outcome: "fail",
            reason: "otp_temp_blocked",
          },
          req
        );
        return response;
      }
      const response = apiError(req, 401, "otp_invalid", "Invalid OTP.", {
        remainingAttempts: failure.remainingAttempts,
      });
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.verify.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/verify",
          outcome: "fail",
          reason: "otp_invalid",
        },
        req
      );
      return response;
    }

    markOtpVerifySuccess(to);

    const customer = upsertCustomer({
      provider: "mobile_otp",
      providerUserId: to,
      phone: to,
      fullName,
    });

    const sessionToken = createCustomerSessionToken({
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: "mobile_otp",
    });

    const response = apiSuccess(req, {
      user: {
        id: customer.id,
        name: customer.fullName,
        email: customer.email,
        phone: customer.phone,
        provider: "mobile_otp",
      },
    });
    response.headers.set("x-request-id", requestId);
    applyCustomerSessionCookie(response, sessionToken);
    clearOtpChallengeCookie(response);
    safeLog(
      "otp.verify.success",
      {
        requestId,
        route: "/api/customer-auth/otp/verify",
        outcome: "success",
      },
      req
    );
    return response;
  } catch (error) {
    logError("OTP VERIFY ERROR", { error });
    safeLog(
      "otp.verify.failed",
      {
        requestId,
        route: "/api/customer-auth/otp/verify",
        outcome: "fail",
        reason: "otp_provider_unavailable",
      },
      req
    );
    const response = apiError(req, 500, "otp_provider_unavailable", "Failed to verify OTP.", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
