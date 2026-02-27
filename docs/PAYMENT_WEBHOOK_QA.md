# Payment Webhook QA

## Endpoint
- `POST /api/payments/webhook`

## Security
- Signature verification required (`x-razorpay-signature`).
- Invalid signature -> `401 INVALID_WEBHOOK_SIGNATURE`.

## Idempotency
- Webhook lock via `webhook_events` unique (`provider`,`event_id`).
- Duplicate delivery:
  - returns `200` with `{ ok: true, skipped: true }`
  - does not reprocess lifecycle update.

## Expected Flow
1. Receive webhook payload.
2. Validate signature.
3. Acquire webhook lock.
4. Parse booking/payment references.
5. Execute payment lifecycle handler.
6. Mark webhook lock record as processed/failed.
7. Write payment webhook heartbeat.

## Failure Handling
- Missing booking id -> `400 BOOKING_ID_MISSING`.
- Parse error -> `400 INVALID_JSON`.
- Internal failure -> `500 PAYMENT_WEBHOOK_FAILED` with safe message.

## Razorpay Dashboard Test Steps
1. Configure webhook URL:
   - `https://www.yonodmc.in/api/payments/webhook?provider=razorpay`
2. Set webhook secret same as `RAZORPAY_WEBHOOK_SECRET`.
3. Trigger payment success event (sandbox).
4. Verify:
   - API returns 200
   - payment status updated
   - booking lifecycle event recorded
   - webhook_events entry created
5. Re-send same event from Razorpay dashboard:
   - verify second delivery returns skipped response and no duplicate processing.
