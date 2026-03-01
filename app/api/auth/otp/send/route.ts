import { apiError, apiSuccess } from "@/lib/backend/http";
import { getClientIp } from "@/lib/backend/rateLimit";
import {
  checkOtpSendGuards,
  getOtpPolicy,
  logOtpRequest,
  maskPhone,
  markOtpSent,
  normalizePhoneE164,
} from "@/lib/auth/otpAbuse";
import {
  TwilioVerifyRequestError,
  TwilioVerifyUnavailableError,
  sendOtpWithTwilio,
} from "@/lib/auth/twilioVerifyFallback";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface SendOtpBody {
  phone?: string;
  country?: string;
  channel?: "sms";
}

const OTP_UNAVAILABLE_MESSAGE =
  "OTP service temporarily unavailable, please try again in 2 minutes or use Email OTP.";

function safeUserAgent(req: Request): string {
  return (req.headers.get("user-agent") || "").slice(0, 240);
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  const policy = getOtpPolicy();
  const ip = getClientIp(req);
  const userAgent = safeUserAgent(req);
  let normalizedPhone = "";

  try {
    const body = (await req.json().catch(() => ({}))) as SendOtpBody;
    const phone = normalizePhoneE164(body.phone || "", body.country);
    normalizedPhone = phone;

    safeLog(
      "auth.otp.send.requested",
      {
        requestId,
        route: "/api/auth/otp/send",
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

    const guard = await checkOtpSendGuards({ phoneE164: phone, ip, policy });
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
      const response = apiError(req, 429, "RATE_LIMITED", "Too many OTP requests. Please try later.", {
        retryAfter: guard.retryAfter,
      });
      response.headers.set("retry-after", String(guard.retryAfter));
      return response;
    }

    const send = await sendOtpWithTwilio(phone);
    await markOtpSent(phone);
    await logOtpRequest({
      phoneE164: phone,
      ip,
      userAgent,
      status: "sent",
      meta: {
        challengeId: send.challengeId || null,
        channel: "sms",
      },
    });

    safeLog(
      "auth.otp.send.success",
      {
        requestId,
        route: "/api/auth/otp/send",
        outcome: "success",
      },
      req
    );

    return apiSuccess(req, {
      phone: maskPhone(phone),
      cooldownSeconds: policy.cooldownSeconds,
    });
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
                ? "otp_send_failed"
                : "otp_send_failed",
          status: error instanceof TwilioVerifyRequestError ? error.status : undefined,
        },
      });
    }

    safeLog(
      "auth.otp.send.failed",
      {
        requestId,
        route: "/api/auth/otp/send",
        outcome: "fail",
        reason:
          error instanceof TwilioVerifyUnavailableError
            ? "otp_provider_unavailable"
            : error instanceof TwilioVerifyRequestError
              ? error.code || "otp_send_failed"
              : "otp_send_failed",
      },
      req
    );

    if (error instanceof TwilioVerifyUnavailableError) {
      return apiError(req, 503, "OTP_PROVIDER_UNAVAILABLE", OTP_UNAVAILABLE_MESSAGE);
    }
    if (error instanceof TwilioVerifyRequestError) {
      const code = error.status === 429 ? "RATE_LIMITED" : "OTP_SEND_FAILED";
      const status = error.status === 429 ? 429 : error.status >= 500 ? 502 : 400;
      return apiError(
        req,
        status,
        code,
        code === "RATE_LIMITED"
          ? "Too many OTP requests. Please try later."
          : "Failed to send OTP. Please retry."
      );
    }
    return apiError(req, 500, "OTP_SEND_FAILED", "Failed to send OTP. Please retry.");
  }
}
