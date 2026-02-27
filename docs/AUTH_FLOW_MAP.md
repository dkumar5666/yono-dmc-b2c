# Auth Flow Map

Last updated: 2026-02-27

## Primary (Supabase) auth routes

| Path | Method | Purpose | Inputs | Outputs | Cookies | Required env |
|---|---|---|---|---|---|---|
| `/api/auth/supabase/google/start` | `GET` | Start Google OAuth (Supabase PKCE) | `role?`, `next?`, profile hints | Redirect to Supabase authorize URL | Sets `yono_supabase_oauth_context` | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SITE_URL` (recommended) |
| `/auth/callback` | `GET` | OAuth callback | `code`, `state` | Redirect to `next` or role default | Reads/clears `yono_supabase_oauth_context`, sets `yono_supabase_session` | same as above + `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` for profile upsert |
| `/api/auth/supabase/otp/send` | `POST` | Send OTP | `{ phone, role?, fullName?, companyName?, city?, next? }` | `{ ok:true, sent:true }` or explicit error codes | Sets `yono_supabase_otp_context` | Supabase public auth env; Twilio env optional fallback |
| `/api/auth/supabase/otp/verify` | `POST` | Verify OTP and create session | `{ phone, token }` | `{ ok:true, verified:true, role, nextPath }` | Reads/clears `yono_supabase_otp_context`, sets `yono_supabase_session` | Supabase env; Twilio fallback env optional |
| `/api/auth/supabase/password/login` | `POST` | Email/password login | `{ email, password, expectedRole? }` | `{ ok:true, loggedIn:true, role }` | Sets `yono_supabase_session` (+ legacy admin cookie for admin) | Supabase env |
| `/api/auth/supabase/logout` | `POST` | Supabase session logout | none | `{ ok:true }` | Clears `yono_supabase_session` and legacy admin cookie | none |

## Session introspection/compatibility routes

| Path | Method | Purpose | Notes |
|---|---|---|---|
| `/api/customer-auth/me` | `GET` | Returns active customer/supabase session | checks `yono_supabase_session` first, then `yono_customer_session` |
| `/api/customer-auth/logout` | `POST` | Customer logout | clears both customer legacy and supabase cookies |
| `/api/auth/me` | `GET` | Office/admin introspection | accepts Supabase admin session, then legacy admin cookie |
| `/api/auth/logout` | `POST` | Office/admin logout | clears both legacy + supabase admin session |

## Legacy routes (kept, not primary)

| Path | Method | Notes |
|---|---|---|
| `/api/customer-auth/google/start` | `GET` | legacy custom Google OAuth |
| `/api/customer-auth/google/callback` | `GET` | legacy callback |
| `/api/customer-auth/otp/send` | `POST` | legacy Twilio OTP |
| `/api/customer-auth/otp/verify` | `POST` | legacy Twilio verify |

## Auth pages

| Path | Purpose |
|---|---|
| `/login` | Unified sign-in: Google, OTP, email/password |
| `/signup` | Unified sign-up: customer or agent |
| `/admin/login` | Office/admin login |
| `/supplier/login` | Supplier login |

## Cookie names in active flow

- `yono_supabase_session`
- `yono_supabase_oauth_context`
- `yono_supabase_otp_context`

Legacy compatibility cookies:

- `yono_customer_session`
- `yono_admin_session`
- `yono_google_oauth_state`
- `yono_google_oauth_next`
- `yono_otp_challenge`
