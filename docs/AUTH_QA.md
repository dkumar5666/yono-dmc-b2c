# Auth QA Notes

## Primary Customer/Auth Flows

### Google (Primary)
1. UI calls: `GET /api/auth/supabase/google/start`
2. Redirects to Supabase OAuth authorize endpoint.
3. Callback route: `GET /auth/callback`
4. Callback validates state cookie, exchanges code, upserts profile, sets `yono_supabase_session`.
5. Redirect target:
   - admin -> `/admin/control-center`
   - supplier -> `/supplier/dashboard`
   - default -> `/my-trips`

### OTP (Primary)
1. UI calls: `POST /api/auth/supabase/otp/send`
2. Route stores OTP context cookie (`yono_supabase_otp_context`).
3. UI calls: `POST /api/auth/supabase/otp/verify`
4. Route verifies OTP (Supabase; Twilio fallback supported), upserts profile, sets `yono_supabase_session`.

### Password login (Office/Supplier/Agent)
- Route: `POST /api/auth/supabase/password/login`
- Optional `expectedRole` gate:
  - `admin`, `supplier`, `agent`

## Legacy Compatibility Flows (Still Present)
- `GET /api/customer-auth/google/start`
- `GET /api/customer-auth/google/callback`
- `POST /api/customer-auth/otp/send`
- `POST /api/customer-auth/otp/verify`
- `GET /api/customer-auth/me`
- `POST /api/customer-auth/logout`

## Session Introspection
- `GET /api/customer-auth/me`
  - reads `yono_supabase_session` first
  - falls back to legacy `yono_customer_session`

## QA Hardening Confirmed
- Google callback paths wrapped in try/catch and return redirect with error code instead of raw 500.
- OAuth state is cookie-based (serverless-safe), not memory-based.
- OTP routes return explicit error codes (`missing_phone`, `invalid_phone`, `otp_expired`, `otp_invalid`, provider errors).
- Structured safe logs are present with `requestId` and reason codes only.

## Known Constraints
- Legacy Google callback uses local customer store path; primary login UI no longer uses legacy path.
- Production should prefer Supabase OAuth route only.
