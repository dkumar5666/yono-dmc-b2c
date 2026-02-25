# Booking-Centric Travel Operating System (TOS)

This implementation introduces a lifecycle-first backend foundation where all operational flows are anchored on `booking_id`.

## 1) Folder Structure (Target Modular Layout)

```txt
app/api/
  core/
    booking-lifecycle/route.ts
  products/
    flights/search/route.ts
    hotels/search/route.ts
    activities/search/route.ts
  payments/
    create-intent/route.ts
    webhook/route.ts
  documents/
    generate/route.ts
  leads/
    route.ts
  admin/
    dashboard/route.ts
  customer/
    bookings/route.ts
  suppliers/
    route.ts

lib/core/
  supabase-rest.ts
  booking-lifecycle.repository.ts
  booking-lifecycle.engine.ts
  booking-lifecycle.handlers.ts
  event-dispatcher.ts

lib/services/
  payment.service.ts
  document.service.ts

types/
  tos.ts

db/supabase/migrations/
  001_booking_centric_tos.sql
```

## 2) Database Schema SQL

- Full SQL is implemented at:
  - `db/supabase/migrations/001_booking_centric_tos.sql`

Includes required core tables:
- `users`
- `customers`
- `suppliers`
- `leads`
- `quotations`
- `bookings`
- `booking_items`
- `payments`
- `invoices`
- `documents`
- `itineraries`
- `products`
- `trips`
- `ground_services`

And supporting lifecycle/refund tables:
- `booking_lifecycle_events`
- `payment_refunds`

### ER Diagram (Text)

```txt
auth.users (Supabase Auth)
  -> users

users
  -> leads.assigned_to
  -> customers.created_by/updated_by
  -> suppliers.created_by/updated_by
  -> bookings.created_by/updated_by
  -> documents.generated_by

customers
  -> leads.customer_id
  -> quotations.customer_id
  -> bookings.customer_id
  -> trips.customer_id
  -> payments.customer_id
  -> documents.customer_id

leads
  -> quotations.lead_id
  -> bookings.lead_id

quotations
  -> bookings.quotation_id
  -> documents.quotation_id

trips
  -> bookings.trip_id

bookings (central)
  -> booking_items.booking_id
  -> payments.booking_id
  -> invoices.booking_id
  -> documents.booking_id
  -> itineraries.booking_id
  -> ground_services.booking_id
  -> booking_lifecycle_events.booking_id

products
  -> booking_items.product_id

suppliers
  -> products.supplier_id
  -> booking_items.supplier_id
  -> ground_services.supplier_id

payments
  -> invoices.payment_id
  -> payment_refunds.payment_id
```

## 3) Lifecycle Engine

Implemented in:
- `lib/core/booking-lifecycle.engine.ts`
- `app/api/core/booking-lifecycle/route.ts`

### Supported Statuses

```txt
lead_created
quotation_sent
quotation_approved
booking_created
payment_pending
payment_confirmed
supplier_confirmed
documents_generated
completed
cancelled
refunded
```

### Transition Rules

```txt
lead_created -> quotation_sent | cancelled
quotation_sent -> quotation_approved | cancelled
quotation_approved -> booking_created | cancelled
booking_created -> payment_pending | cancelled
payment_pending -> payment_confirmed | cancelled | refunded
payment_confirmed -> supplier_confirmed | cancelled | refunded
supplier_confirmed -> documents_generated | cancelled | refunded
documents_generated -> completed | cancelled | refunded
completed -> refunded
cancelled -> refunded
refunded -> (terminal)
```

### Lifecycle API Example

`POST /api/core/booking-lifecycle`

```json
{
  "bookingId": "7f8054b2-376f-4e0e-a7d2-6e4f31b9d153",
  "toStatus": "payment_confirmed",
  "actorType": "webhook",
  "actorId": null,
  "note": "Razorpay webhook confirmed",
  "idempotencyKey": "webhook:evt_123",
  "metadata": {
    "provider": "razorpay",
    "paymentId": "pay_abc123"
  }
}
```

## 4) TypeScript Interfaces

Primary TOS interfaces are in:
- `types/tos.ts`

Includes:
- `BookingLifecycleStatus`
- `TosBooking`
- `TosPayment`
- `TosDocument`
- `TosLifecycleEvent`
- payment/document lifecycle input/output contracts

## 5) Example Booking Flow (Implementation)

1. Create lead/quotation/booking in DB.
2. Create payment intent:
   - `POST /api/payments/create-intent`
3. Redirect customer to provider checkout.
4. Provider sends webhook:
   - `POST /api/payments/webhook?provider=razorpay`
5. Webhook updates payment + triggers lifecycle:
   - `payment_pending -> payment_confirmed`
6. Automation handlers generate documents and audit events.

### Create Intent Request

`POST /api/payments/create-intent`

```json
{
  "bookingId": "7f8054b2-376f-4e0e-a7d2-6e4f31b9d153",
  "provider": "razorpay",
  "idempotencyKey": "intent:booking:7f8054..."
}
```

### Create Intent Response (Example)

```json
{
  "ok": true,
  "data": {
    "payment": {
      "id": "c665e560-f5ae-4b1c-8172-f5b5b7d15dea",
      "booking_id": "7f8054b2-376f-4e0e-a7d2-6e4f31b9d153",
      "provider": "razorpay",
      "status": "requires_action"
    },
    "providerPayload": {
      "provider": "razorpay",
      "orderId": "order_..."
    }
  },
  "requestId": "..."
}
```

## 6) Payment Webhook Handler

Implemented in:
- `app/api/payments/webhook/route.ts`
- `lib/services/payment.service.ts`

Features:
- HMAC verification (`x-razorpay-signature` / `stripe-signature` / `x-payment-signature`)
- idempotency via `payments.webhook_event_id`
- transition trigger to lifecycle engine
- safe error responses for missing config and invalid signatures

## 7) Event Dispatcher Pattern

Implemented in:
- `lib/core/event-dispatcher.ts`
- `lib/core/booking-lifecycle.handlers.ts`

Automations currently wired:
- `payment_confirmed` -> invoice generation
- `supplier_confirmed` -> voucher + itinerary generation
- `completed` -> customer communication event log

## 8) Auth and RBAC Design

Current backend compatibility:
- Admin RBAC uses existing `requireRoles()` guard (`admin`/`editor`).

Production target with Supabase Auth:
- `users.id` references `auth.users.id`.
- JWT role claims should map to application roles (`admin`, `staff`, `supplier`, `customer`).
- Apply RLS on tables by role + ownership (`customer_id`, `supplier_id`, assigned staff).

## 9) Scalability and Migration Readiness

The new layout is ready for:
- multi-product bookings under one `booking_id`
- multi-supplier confirmations and references
- multi-currency amounts and reconciliations
- idempotent webhooks
- document storage abstraction (Supabase Storage)
- service-based migration to microservices later

Recommended next hardening tasks:
1. Add RLS policies per table in Supabase.
2. Add durable queue for events (Upstash/Kafka/SQS) replacing in-process dispatcher.
3. Add structured observability (OpenTelemetry + error tracking).
4. Add distributed rate limiting for all public endpoints.
