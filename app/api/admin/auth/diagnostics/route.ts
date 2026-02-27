import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  CUSTOMER_AUTH_COOKIE_NAME,
  GOOGLE_STATE_COOKIE_NAME,
  OTP_CHALLENGE_COOKIE_NAME,
} from "@/lib/backend/customerAuth";
import {
  SUPABASE_SESSION_COOKIE_NAME,
  SUPABASE_OAUTH_CONTEXT_COOKIE_NAME,
  SUPABASE_OTP_CONTEXT_COOKIE_NAME,
} from "@/lib/auth/supabaseSession";

export async function GET(req: Request) {
  const access = requireRole(req, "admin");
  if (access.denied) return access.denied;

  const hasGoogleClientId = Boolean(process.env.GOOGLE_CLIENT_ID?.trim()); // legacy custom Google flow
  const hasGoogleClientSecret = Boolean(process.env.GOOGLE_CLIENT_SECRET?.trim()); // legacy custom Google flow
  const hasSupabaseUrl = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || process.env.SUPABASE_URL?.trim()
  );
  const hasSupabaseAnonKey = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
      process.env.SUPABASE_ANON_KEY?.trim()
  );
  const hasSupabaseServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());
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
      hasSupabaseUrl,
      hasSupabaseAnonKey,
      hasSupabaseServiceRole,
      hasOtpProviderKey,
      hasCookieSecret,
    },
    routes: {
      googleStart: "/api/auth/supabase/google/start",
      googleCallback: "/auth/callback",
      otpSend: "/api/auth/supabase/otp/send",
      otpVerify: "/api/auth/supabase/otp/verify",
      legacyGoogleStart: "/api/customer-auth/google/start",
      legacyGoogleCallback: "/api/customer-auth/google/callback",
      legacyOtpSend: "/api/customer-auth/otp/send",
      legacyOtpVerify: "/api/customer-auth/otp/verify",
    },
    cookies: {
      customerSessionCookieName: CUSTOMER_AUTH_COOKIE_NAME,
      googleStateCookieName: GOOGLE_STATE_COOKIE_NAME,
      otpChallengeCookieName: OTP_CHALLENGE_COOKIE_NAME,
      supabaseSessionCookieName: SUPABASE_SESSION_COOKIE_NAME,
      supabaseOauthContextCookieName: SUPABASE_OAUTH_CONTEXT_COOKIE_NAME,
      supabaseOtpContextCookieName: SUPABASE_OTP_CONTEXT_COOKIE_NAME,
    },
  });
}
