import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  CUSTOMER_AUTH_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
  OTP_CHALLENGE_COOKIE_NAME,
} from "@/lib/backend/customerAuth";

export async function GET(req: Request) {
  const access = requireRole(req, "admin");
  if (access.denied) return access.denied;

  const hasGoogleClientId = Boolean(process.env.GOOGLE_CLIENT_ID?.trim());
  const hasGoogleClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim());
  const hasOtpProviderKey = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_AUTH_TOKEN?.trim() &&
      process.env.TWILIO_VERIFY_SERVICE_SID?.trim()
  );
  const hasCookieSecret = Boolean(
    process.env.AUTH_SESSION_SECRET?.trim() || process.env.NEXTAUTH_SECRET?.trim()
  );

  return NextResponse.json({
    env: {
      hasGoogleClientId,
      hasGoogleClientSecret,
      hasOtpProviderKey,
      hasCookieSecret,
    },
    routes: {
      googleStart: "/api/customer-auth/google/start",
      googleCallback: "/api/customer-auth/google/callback",
      otpSend: "/api/customer-auth/otp/send",
      otpVerify: "/api/customer-auth/otp/verify",
    },
    cookies: {
      customerSessionCookieName: CUSTOMER_AUTH_COOKIE_NAME,
      googleStateCookieName: GOOGLE_STATE_COOKIE_NAME,
      otpChallengeCookieName: OTP_CHALLENGE_COOKIE_NAME,
    },
  });
}

