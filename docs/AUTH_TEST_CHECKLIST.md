# Auth Test Checklist

## Pre-check
1. Confirm env vars via admin endpoint:
   - `GET /api/admin/system/env-check`
2. Confirm Google OAuth redirect URIs are registered:
   - `https://yonodmc.in/auth/callback`
   - `https://www.yonodmc.in/auth/callback`
   - `http://localhost:3000/auth/callback`

## Local (http://localhost:3000)

### A) Google Login
1. Open `/login`
2. Click `Continue with Google`
3. Complete consent
4. Expected:
   - redirected back to `/auth/callback`
   - then redirected to `/my-trips`
   - `GET /api/customer-auth/me` returns 200 user payload

### B) OTP Send + Verify
1. On `/login`, enter phone in E.164 format (`+91...`)
2. Click `Send OTP`
3. Enter OTP and verify
4. Expected:
   - verify endpoint returns 200
   - session cookie set
   - redirected to `/my-trips`

### C) Negative Cases
1. Call OTP verify without send/context
   - expected 400 `otp_expired`
2. Use wrong OTP
   - expected 401 `otp_invalid`
3. Missing phone in send
   - expected 400 `missing_phone`

## Production (https://www.yonodmc.in)

### A) Google
1. `/login` -> Google -> consent
2. Expected no raw 500.
3. On failure, expected redirect:
   - `/login?error=<code>&rid=<requestId>`

### B) OTP
1. Send OTP
2. Verify OTP
3. Expected explicit error codes on failure, not generic 500.

### C) Role Portals
1. `/agent/login` only allows agent role
2. `/supplier/login` only allows supplier role
3. `/admin/login` only allows admin role

## Logs Validation
- In Vercel function logs, filter by request id (`rid`) from login error query string.
- Check safe log events:
  - `auth.supabase.google.*`
  - `auth.supabase.otp.*`
  - `otp.send.*` / `otp.verify.*` (legacy)
