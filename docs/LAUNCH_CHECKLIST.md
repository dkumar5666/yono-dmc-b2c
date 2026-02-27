# Launch Checklist

## Vercel Environment Variables (names only)
- Core: `SITE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Auth: `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET`)
- OTP fallback: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`
- Payments: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- Internal: `INTERNAL_CRON_KEY`
- Supplier: `AMADEUS_ENV`, `AMADEUS_BASE_URL`, `AMADEUS_CLIENT_ID`, `AMADEUS_CLIENT_SECRET`

## Supabase
- RLS enabled for protected tables.
- Service role key set in Vercel only (never client-side).
- Required profile/role tables available and accessible from server APIs.

## Google OAuth
- Authorized redirect URIs:
  - `https://yonodmc.in/auth/callback`
  - `https://www.yonodmc.in/auth/callback`
  - `http://localhost:3000/auth/callback`
- Authorized JavaScript origins:
  - `https://yonodmc.in`
  - `https://www.yonodmc.in`
  - `http://localhost:3000`

## Razorpay
- Webhook URL points to:
  - `https://www.yonodmc.in/api/payments/webhook?provider=razorpay`
- Webhook secret matches `RAZORPAY_WEBHOOK_SECRET`.
- Retry duplicate event test confirmed idempotent behavior.

## Cron / Retry Worker
- Internal retry route protected by `INTERNAL_CRON_KEY`.
- If cron is used, verify schedule + secret configured and heartbeat updates.

## Domain Canonicalization
- Decide canonical host (`www` or non-www) and keep OAuth, cookies, redirects consistent.
- Ensure both domains route to same production deployment if both remain active.

## Final Pre-Go-Live
- Run and pass:
  - `npm run lint`
  - `npm run typecheck`
  - `npm run build`
- Complete `docs/SMOKE_TESTS.md` checklist on production.
