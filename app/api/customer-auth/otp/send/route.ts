import crypto from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { logError } from "@/lib/backend/logger";
import { checkOtpSendAllowed, markOtpSent } from "@/lib/backend/otpGuard";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import { applyOtpChallengeCookie } from "@/lib/backend/customerAuth";
import { getTwilioVerifyConfig } from "@/lib/backend/twilioVerifyConfig";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

const TWILIO_VERIFY_API_BASE = "https://verify.twilio.com/v2";

interface SendOtpBody {
  mobile?: string;
}

interface TwilioSendOtpResponse {
  sid?: string;
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
      "otp.send.requested",
      {
        requestId,
        route: "/api/customer-auth/otp/send",
      },
      req
    );

    const ip = getClientIp(req);
    const ipLimit = consumeRateLimit(`otp-send-ip:${ip}`, 20, 15 * 60 * 1000);
    if (!ipLimit.ok) {
      safeLog(
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
          outcome: "fail",
          reason: "rate_limited",
        },
        req
      );
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Too many OTP requests. Try again later.",
        { retryAfterSeconds: ipLimit.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set("retry-after", String(ipLimit.retryAfterSeconds));
      return response;
    }

    const twilioConfig = getTwilioVerifyConfig();
    if (!twilioConfig.ok) {
      safeLog(
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
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

    const body = (await req.json()) as SendOtpBody;
    const to = normalizeMobile(body.mobile ?? "");
    if (!to) {
      const response = apiError(
        req,
        400,
        "missing_phone",
        "Mobile number is required."
      );
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
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
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
          outcome: "fail",
          reason: "invalid_phone",
        },
        req
      );
      return response;
    }

    const mobileLimit = consumeRateLimit(`otp-send-mobile:${to}`, 8, 15 * 60 * 1000);
    if (!mobileLimit.ok) {
      safeLog(
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
          outcome: "fail",
          reason: "rate_limited_mobile",
        },
        req
      );
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Too many OTP requests for this number. Try again later.",
        { retryAfterSeconds: mobileLimit.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      response.headers.set("retry-after", String(mobileLimit.retryAfterSeconds));
      return response;
    }

    const sendAllowed = checkOtpSendAllowed(to);
    if (!sendAllowed.ok) {
      if (sendAllowed.reason === "blocked") {
        const response = apiError(
          req,
          429,
          "rate_limited",
          "Too many failed attempts. Try again later.",
          { retryAfterSeconds: sendAllowed.retryAfterSeconds }
        );
        response.headers.set("x-request-id", requestId);
        safeLog(
          "otp.send.failed",
          {
            requestId,
            route: "/api/customer-auth/otp/send",
            outcome: "fail",
            reason: "otp_temp_blocked",
          },
          req
        );
        return response;
      }
      const response = apiError(
        req,
        429,
        "rate_limited",
        "Please wait before requesting OTP again.",
        { retryAfterSeconds: sendAllowed.retryAfterSeconds }
      );
      response.headers.set("x-request-id", requestId);
      safeLog(
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
          outcome: "fail",
          reason: "otp_cooldown",
        },
        req
      );
      return response;
    }

    const apiUrl = `${TWILIO_VERIFY_API_BASE}/Services/${verifyServiceSid}/Verifications`;
    const payload = new URLSearchParams({ To: to, Channel: "sms" });
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
        "otp.send.failed",
        {
          requestId,
          route: "/api/customer-auth/otp/send",
          outcome: "fail",
          reason: "otp_send_failed",
          twilioStatus: twilioRes.status,
        },
        req
      );
      const response = apiError(
        req,
        502,
        "otp_send_failed",
        "Failed to send OTP.",
        twilioText
      );
      response.headers.set("x-request-id", requestId);
      return response;
    }

    const twilioPayload = (await twilioRes.json().catch(() => null)) as
      | TwilioSendOtpResponse
      | null;
    markOtpSent(to);
    const response = apiSuccess(req, { sent: true, cooldownSeconds: 45 });
    response.headers.set("x-request-id", requestId);
    applyOtpChallengeCookie(response, {
      phone: to,
      challengeId: twilioPayload?.sid || crypto.randomUUID(),
    });
    safeLog(
      "otp.send.success",
      {
        requestId,
        route: "/api/customer-auth/otp/send",
        outcome: "success",
        hasChallengeId: Boolean(twilioPayload?.sid),
      },
      req
    );
    return response;
  } catch (error) {
    logError("OTP SEND ERROR", { error });
    safeLog(
      "otp.send.failed",
      {
        requestId,
        route: "/api/customer-auth/otp/send",
        outcome: "fail",
        reason: "otp_send_failed",
      },
      req
    );
    const response = apiError(req, 500, "otp_send_failed", "Failed to send OTP.", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
    response.headers.set("x-request-id", requestId);
    return response;
  }
}
