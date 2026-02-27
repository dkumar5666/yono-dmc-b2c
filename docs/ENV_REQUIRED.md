# Required Environment Variables (Names Only)

## Core
- `SITE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

## Auth
- `AUTH_SESSION_SECRET` (or `NEXTAUTH_SECRET`)
- `GOOGLE_CLIENT_ID` (legacy Google flow)
- `GOOGLE_CLIENT_SECRET` (legacy Google flow)

## OTP
- Supabase phone auth requires valid Supabase public auth config.
- Twilio fallback (recommended):
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
  - `TWILIO_VERIFY_SERVICE_SID`

## Payments
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

## Internal
- `INTERNAL_CRON_KEY`

## Suppliers (Amadeus)
- `AMADEUS_ENV`
- `AMADEUS_BASE_URL`
- `AMADEUS_CLIENT_ID`
- `AMADEUS_CLIENT_SECRET`

## Optional / Compatibility
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SITE_URL`
- `APP_URL`
- `NEXTAUTH_URL`
