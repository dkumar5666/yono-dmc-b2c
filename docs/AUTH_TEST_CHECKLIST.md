# Auth Test Checklist

Last updated: 2026-02-27

Use this checklist before enabling customer signups in production.

## Pre-check (Local + Production)

1. Verify required env vars exist:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET`)
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_VERIFY_SERVICE_SID`
   - `SITE_URL` (recommended in production)
2. Confirm Google OAuth authorized redirect URIs include:
   - `https://yonodmc.in/api/customer-auth/google/callback`
   - `https://www.yonodmc.in/api/customer-auth/google/callback`
   - `http://localhost:3000/api/customer-auth/google/callback`

## A) Local Tests (`http://localhost:3000`)

### 1. Mobile OTP send + verify
1. Open `/login`.
2. Enter valid E.164 phone (for example: `+9198XXXXXXXX`).
3. Click **Continue**.
4. Expected:
   - OTP send API success (`/api/customer-auth/otp/send`)
   - `yono_otp_challenge` cookie set (httpOnly).
5. Enter OTP and click **Continue**.
6. Expected:
   - `/api/customer-auth/otp/verify` success
   - `yono_customer_session` cookie set
   - redirect to `next` path or `/`

### 2. OTP failure cases
1. Submit empty phone.
   - Expected error code: `missing_phone`
2. Submit invalid phone format.
   - Expected error code: `invalid_phone`
3. Verify without OTP challenge (clear cookies then verify).
   - Expected error code: `otp_expired`
4. Verify with wrong OTP.
   - Expected error code: `otp_invalid`

### 3. Google login success
1. Click **Sign in with Google**.
2. Complete consent.
3. Expected:
   - callback route `/api/customer-auth/google/callback` returns redirect, not raw 500
   - `yono_customer_session` set
   - redirects to safe next path or `/my-trips`

### 4. Google failure modes
1. Temporarily remove `GOOGLE_CLIENT_ID` locally.
   - Expected redirect to `/login?error=google_oauth_not_configured&rid=...`
2. Force state mismatch (clear `yono_google_oauth_state` before callback).
   - Expected redirect to `/login?error=google_state_mismatch&rid=...`
3. Verify callback never shows uncaught 500.

### 5. Logout
1. Call `/api/customer-auth/logout` (via UI or API).
2. Expected:
   - `yono_customer_session` cleared
   - `/api/customer-auth/me` returns 401.

### 6. Trips access control
1. Logged out: open `/my-trips`.
   - Expected redirect/login prompt.
2. Logged in: open `/my-trips`.
   - Expected bookings page visible.

## B) Production Tests (`https://www.yonodmc.in`)

Run the exact same scenarios as Local A1-A6.

Additional checks:
1. Confirm callbacks use production host correctly.
2. Confirm no mixed-domain issue between `yonodmc.in` and `www.yonodmc.in`.
3. Confirm error redirects include `rid` parameter for traceability.

## Logs / Observability

1. Open Vercel dashboard -> Project -> Functions Logs.
2. Filter by request id:
   - Use `rid` from login error URL (`/login?...&rid=<id>`), or
   - `x-request-id` response header for API calls.
3. Look for structured events:
   - `auth.google.start.requested/success/failed`
   - `auth.google.callback.requested/success/failed`
   - `otp.send.requested/success/failed`
   - `otp.verify.requested/success/failed`
   - `auth.customer.logout.requested/success/failed`

