# Yono DMC Auth Setup Guide (Supabase-first)

Last updated: 2026-02-27

## 1) Required architecture

- Primary identity provider: **Supabase Auth**
- Roles: `customer`, `agent`, `supplier`, `admin`
- Profile storage: `profiles`, `agent_profiles`, `supplier_profiles`
- Session cookie used by app: `yono_supabase_session`
- Legacy cookies/routes remain only for backward compatibility.

## 2) Apply database migration

Run this migration in Supabase SQL Editor:
- `supabase/migrations/2026_identity_roles.sql`

This migration creates:
- `profiles`
- `agent_profiles`
- `supplier_profiles`
- RLS policies
- `auth.users` trigger to auto-create profile rows

## 3) Supabase dashboard configuration

### 3.1 Auth -> URL Configuration

Set:
- **Site URL**: `https://www.yonodmc.in` (or your canonical production domain)

Add **Additional Redirect URLs**:
- `http://localhost:3000/auth/callback`
- `https://yonodmc.in/auth/callback`
- `https://www.yonodmc.in/auth/callback`

### 3.2 Auth -> Providers -> Google

Enable Google provider.

Use Google OAuth Client credentials (created in Google Cloud) inside Supabase provider settings.

### 3.3 Auth -> Providers -> Phone

Enable Phone provider.

If using Twilio via Supabase:
- Configure Twilio SID/Auth Token/Messaging setup in Supabase Phone provider settings.

If Supabase Phone provider is not available yet, app routes can fallback to Twilio Verify credentials while still creating Supabase-backed sessions.

## 4) Google Cloud OAuth settings (for Supabase provider)

In Google Cloud OAuth client:

### Authorized redirect URIs
- `https://<YOUR_SUPABASE_PROJECT_REF>.supabase.co/auth/v1/callback`

### Authorized JavaScript origins
- `http://localhost:3000`
- `https://yonodmc.in`
- `https://www.yonodmc.in`

## 5) Vercel environment variables

Set these on Vercel project (Production + Preview + Development as needed):

### Required
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server only)
- `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET`)
- `SITE_URL` (recommended canonical production URL)

### Optional / legacy compatibility
- `SUPABASE_URL` (if used by server REST helper)
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_VERIFY_SERVICE_SID`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` (legacy custom customer OAuth routes only)

## 6) Role assignment model

### Customer / Agent
- Signup via `/signup`
- Role hint from signup can set only:
  - `customer`
  - `agent`

### Supplier
- Create supplier user in Supabase Auth (email/phone).
- In DB, set:
  - `profiles.role = 'supplier'`
  - create/update `supplier_profiles` row.

### Admin (office)
- Create admin user in Supabase Auth.
- In DB, set:
  - `profiles.role = 'admin'`
- Admin logs in at `/admin/login`.

## 7) End-to-end verification checklist

1. B2C Google signup/login:
   - `/signup` -> Google
   - callback hits `/auth/callback`
   - `profiles` row exists with role `customer`

2. B2C OTP signup/login:
   - `/signup` -> OTP send -> verify
   - `profiles` row exists/updated
   - session cookie `yono_supabase_session` set
   - if Supabase Phone is unavailable, Twilio Verify fallback path should still complete sign-in and profile creation

3. B2B Agent signup:
   - `/signup` choose Agent
   - complete Google or OTP flow
   - `profiles.role = 'agent'`
   - `agent_profiles` row created

4. Admin login:
   - `/admin/login`
   - successful login redirects `/admin/control-center`

5. Supplier login:
   - `/supplier/login`
   - successful login redirects `/supplier/dashboard`

6. Access controls:
   - `/my-trips` only customer/agent
   - `/supplier/dashboard` only supplier
   - `/admin/*` APIs only admin role

## 8) Troubleshooting quick notes

- If Google fails:
  - verify Supabase Google provider is enabled
  - verify Google redirect URI points to Supabase callback URL
  - verify app redirect URLs in Supabase include `/auth/callback`
- If OTP fails:
  - verify Supabase Phone provider is enabled
  - verify SMS provider config in Supabase
- If login succeeds but role access fails:
  - check `profiles.role` for the user id in Supabase table editor
