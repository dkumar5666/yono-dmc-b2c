# Auth Current State (Yono DMC)

Last updated: 2026-02-27

## 1) Current auth entry points

### New unified Supabase Auth routes (active for new flows)

| Path | Method | Purpose | Notes |
|---|---|---|---|
| `/api/auth/supabase/google/start` | `GET` | Start Google OAuth via Supabase | Uses PKCE + signed OAuth context cookie |
| `/auth/callback` | `GET` | OAuth callback handler | Exchanges code with Supabase, upserts profile, sets Supabase session cookie |
| `/api/auth/supabase/otp/send` | `POST` | Send phone OTP via Supabase | Stores OTP challenge context cookie |
| `/api/auth/supabase/otp/verify` | `POST` | Verify phone OTP via Supabase | Creates/updates profile + sets Supabase session cookie |
| `/api/auth/supabase/password/login` | `POST` | Email/password login via Supabase | Supports `expectedRole` for admin/supplier portals |
| `/api/auth/supabase/logout` | `POST` | Unified logout | Clears Supabase cookie and legacy admin cookie |

### Legacy customer auth routes (kept for compatibility)

| Path | Method | Purpose | Status |
|---|---|---|---|
| `/api/customer-auth/google/start` | `GET` | Custom Google OAuth start | Legacy (not used by new login page) |
| `/api/customer-auth/google/callback` | `GET` | Custom Google OAuth callback | Legacy |
| `/api/customer-auth/otp/send` | `POST` | Twilio Verify OTP send | Legacy |
| `/api/customer-auth/otp/verify` | `POST` | Twilio Verify OTP verify | Legacy |
| `/api/customer-auth/me` | `GET` | Session introspection | Supports Supabase session first, then legacy customer cookie |
| `/api/customer-auth/logout` | `POST` | Customer logout | Clears both legacy + Supabase customer session cookies |

### Legacy admin auth routes (kept in parallel)

| Path | Method | Purpose | Status |
|---|---|---|---|
| `/api/auth/login` | `POST` | Legacy admin cookie login | Kept for backward compatibility |
| `/api/auth/me` | `GET` | Admin session introspection | Supports Supabase admin session and legacy admin cookie |
| `/api/auth/logout` | `POST` | Admin logout | Clears both legacy and Supabase session cookies |

## 2) Auth pages currently present

| Path | Purpose |
|---|---|
| `/login` | Unified sign in (Google + mobile OTP + office/supplier email login) |
| `/signup` | B2C/B2B signup (Customer/Agent) using Google or OTP |
| `/admin/login` | Official office admin login (Supabase email/password, optional Google start) |
| `/supplier/login` | Supplier login (Supabase email/password) |

## 3) Cookies currently in use

### New
- `yono_supabase_session` (signed app session envelope around Supabase token data)
- `yono_supabase_oauth_context` (state + PKCE verifier + role hints)
- `yono_supabase_otp_context` (phone OTP challenge context)

### Legacy (still present)
- `yono_customer_session`
- `yono_admin_session`
- `yono_google_oauth_state`
- `yono_google_oauth_next`
- `yono_otp_challenge`

## 4) Session logic summary

1. New flows create `yono_supabase_session`.
2. Server helpers read Supabase cookie for role-based access:
   - `lib/auth/supabaseUser.ts`
   - `lib/auth/requireUser.ts`
   - `lib/auth/requireRole.ts`
3. API middleware role checks (`lib/middleware/requireRole.ts`) now accept:
   - Bearer JWT (Supabase)
   - Supabase session cookie role
   - Legacy admin cookie (admin-only compatibility)

## 5) OTP implementation status

- New primary OTP flow: Supabase Phone Auth (`/api/auth/supabase/otp/*`).
- New fallback path inside the same Supabase OTP routes:
  - if Supabase phone provider is unavailable, send/verify falls back to Twilio Verify.
  - verified fallback still mints Supabase session for unified identity.
- Legacy Twilio routes (`/api/customer-auth/otp/*`) remain for compatibility only and are not used by new login/signup UI.

## 6) Google OAuth implementation status

- New primary Google flow: Supabase OAuth via `/api/auth/supabase/google/start` -> `/auth/callback`.
- Legacy custom Google OAuth remains under `/api/customer-auth/google/*` for compatibility.

## 7) Role and profile storage

- Unified profile model is in migration: `supabase/migrations/2026_identity_roles.sql`
  - `profiles`
  - `agent_profiles`
  - `supplier_profiles`
- Profile row is auto-created from `auth.users` trigger.
- Self-service role hints are restricted to `customer` and `agent` to prevent privilege escalation.
