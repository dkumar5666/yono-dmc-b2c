# Amadeus QA

## Config
- Config source: `lib/config/amadeus.ts`
- Required env names:
  - `AMADEUS_ENV`
  - `AMADEUS_BASE_URL`
  - `AMADEUS_CLIENT_ID`
  - `AMADEUS_CLIENT_SECRET`

## Validation Rules
- Missing env throws explicit error with names only.
- `AMADEUS_BASE_URL` must be valid URL.
- No secrets exposed in responses.

## Recommended Sandbox Values
- `AMADEUS_ENV=test`
- `AMADEUS_BASE_URL=https://test.api.amadeus.com`

## QA Test Steps
1. Call flight search endpoint used by frontend (`/api/flights/search` or `/api/products/flights/search`).
2. Verify successful response for known route query.
3. Verify supplier logs (if configured) include search attempts and failures.
4. Temporarily unset one Amadeus env variable in local env and confirm endpoint fails fast with missing-env error name(s), not silent 500.

## Booking Idempotency Foundation
- Supplier booking lock helper exists in:
  - `lib/system/supplierLock.ts`
  - `lib/backend/supplierBooking.ts`
- Guard is designed to prevent duplicate provider booking for same idempotency key.
