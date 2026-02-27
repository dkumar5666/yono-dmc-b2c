# Auth Flow Map

Last updated: 2026-02-27

This document inventories current authentication-related routes and dependencies.

## Core Customer Auth Routes (`/api/customer-auth/*`)

| Path | Method | Purpose | Input | Output | Cookies | Required Env |
|---|---|---|---|---|---|---|
| `/api/customer-auth/google/start` | `GET` | Start Google OAuth flow | Query: `next` (optional safe internal path) | Redirect to Google OAuth URL | Sets `yono_google_oauth_state`, `yono_google_oauth_next` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, optional `SITE_URL` / `NEXT_PUBLIC_SITE_URL` / `APP_URL` / `NEXTAUTH_URL` |
| `/api/customer-auth/google/callback` | `GET` | Handle Google OAuth callback, create customer session | Query: `code`, `state` | Redirect to `/my-trips` (or safe next path) or `/login?error=...&rid=...` | Reads + clears `yono_google_oauth_state`, `yono_google_oauth_next`; sets `yono_customer_session` on success | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `AUTH_SESSION_SECRET` or `NEXTAUTH_SECRET`, optional base URL env |
| `/api/customer-auth/otp/send` | `POST` | Send OTP via Twilio Verify | JSON: `{ mobile }` (E.164 format) | JSON success or explicit error code | Sets `yono_otp_challenge` on success | `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID` |
| `/api/customer-auth/otp/verify` | `POST` | Verify OTP and create customer session | JSON: `{ mobile, code, name? }` | JSON success with user or explicit error code | Reads `yono_otp_challenge`; clears on success; sets `yono_customer_session` | Twilio env vars above + `AUTH_SESSION_SECRET`/`NEXTAUTH_SECRET` |
| `/api/customer-auth/me` | `GET` | Customer session introspection (logged-in state) | Cookie: `yono_customer_session` | JSON user if valid session else 401 | Reads `yono_customer_session` | Session secret env for token verify |
| `/api/customer-auth/logout` | `POST` | Customer logout | none | `{ ok: true }` | Clears `yono_customer_session` | none |
| `/api/customer-auth/password/forgot/verify` | `POST` | OTP verify for forgot-password flow | JSON: `{ mobile, code }` | reset token response or error | Uses OTP guard + Twilio verify | Twilio env vars |
| `/api/customer-auth/password/forgot/reset` | `POST` | Reset password after verify | JSON: reset payload | success/error JSON | none | depends on password reset token logic |

## Admin / Office Auth Routes (`/api/auth/*`)

| Path | Method | Purpose | Input | Output | Cookies | Required Env |
|---|---|---|---|---|---|---|
| `/api/auth/login` | `POST` | Admin/office login | JSON: `{ username, password }` | user payload or error | sets admin session cookie (legacy admin auth cookie) | `AUTH_USERS`/admin credential envs used by `sessionAuth` |
| `/api/auth/logout` | `POST` | Admin logout | none | `{ ok: true }` | clears admin session cookie | none |
| `/api/auth/me` | `GET` | Admin session introspection | admin session cookie | user/session info | reads admin cookie | admin session secret env |

## Login/Signup UI Pages

| Path | Type | Notes |
|---|---|---|
| `/login` | Customer login/signup page | Uses Google Start + OTP Send/Verify routes; redirects to `next` param or `/` |
| `/admin/login` | Admin login page | Uses `/api/auth/login` |

## Payment/Auth Adjacent API Routes (`/api/*`)

| Path | Method | Purpose | Notes |
|---|---|---|---|
| `/api/payments/create-intent` | `POST` | Create payment intent | Payment flow |
| `/api/payments/confirm` | `POST` | Confirm payment | Payment flow |
| `/api/payments/intent` | `GET/POST` | Payment intent helper route | Payment flow |
| `/api/payments/webhook` | `POST` | Provider webhook receiver | Uses webhook idempotency table |
| `/api/internal/automation/retry` | `GET/POST` | Internal cron retry endpoint | Protected by internal key |

## Cookie Names Used

- `yono_customer_session` (customer auth session)
- `yono_google_oauth_state` (Google OAuth CSRF state)
- `yono_google_oauth_next` (post-login safe next path)
- `yono_otp_challenge` (OTP challenge metadata, no OTP code stored)

## Notes on Expected Failures

- Google callback should now redirect to `/login?error=<code>&rid=<requestId>` instead of returning an uncaught 500.
- OTP send/verify should return explicit JSON error codes (`missing_phone`, `invalid_phone`, `otp_provider_unavailable`, `otp_send_failed`, `otp_invalid`, `otp_expired`) instead of generic failures.

