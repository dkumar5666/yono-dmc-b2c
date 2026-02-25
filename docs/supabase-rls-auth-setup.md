# Supabase RLS + Auth Role Setup (Production)

This document applies to the booking-centric TOS schema and RLS migration.

## 1) Run Migrations

Execute in Supabase SQL Editor (in order):

1. `db/supabase/migrations/001_booking_centric_tos.sql`
2. `db/supabase/migrations/002_rls_policies.sql`

## 2) JWT Role Claim Strategy

RLS policies read role in this order:

1. `user_role` (top-level JWT claim)
2. `app_metadata.role`
3. `role`

Supported app roles:
- `admin`
- `customer`
- `supplier`

## 3) Set Role in Supabase Auth

Use server-side admin flow (never from browser) to write role into `app_metadata.role`.

Example SQL for controlled setup:

```sql
update auth.users
set raw_app_meta_data =
  coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'customer')
where id = 'YOUR_AUTH_USER_UUID';
```

Repeat with role `admin` / `supplier` for those users.

## 4) JWT Signature Verification in API

`lib/auth/getUserRoleFromJWT.ts` verifies HS256 tokens when `SUPABASE_JWT_SECRET` is set.

Required env for strict verification:
- `SUPABASE_JWT_SECRET`

If this env is missing, role is decoded but signature is not cryptographically verified.

## 5) Route Guard Usage

Use:

```ts
import { requireRole } from "@/lib/middleware/requireRole";

const auth = requireRole(req, "admin");
if (auth.denied) return auth.denied;
```

Supported:
- `requireRole(req, "admin")`
- `requireRole(req, "customer")`
- `requireRole(req, ["admin", "supplier"])`

## 6) Service-Role Safety

`lib/core/supabase-rest.ts` is marked `server-only` and documented with strict rules:

- `SUPABASE_SERVICE_ROLE_KEY` only in server runtime
- never exposed to client bundle
- never returned in API responses

For browser/client calls, use only:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 7) Supabase Auth Integration Checklist

1. Enable Email/Phone/OAuth providers in Supabase Auth.
2. Ensure each authenticated user has a mapped row in:
   - `public.users`
   - `public.customers` (for customer users) OR `public.suppliers` (for supplier users)
3. Set `app_metadata.role` per user.
4. Ensure supplier rows have `suppliers.user_id = auth.users.id`.
5. Pass access token in API calls:
   - `Authorization: Bearer <access_token>`

## 8) Example Protected Route

Implemented at:

- `app/api/admin/reports/route.ts`

This route requires `admin` role via JWT middleware guard.
