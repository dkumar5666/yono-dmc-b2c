# Customer Journey Smoke Tests

## 1) Homepage + Login Entry
1. Open `/`
2. Click `Sign in`
3. Expected: login page loads without console/runtime errors.

## 2) Google Login
1. On `/login`, click Google sign in.
2. Complete Google consent.
3. Expected: redirect back and active session.

## 3) OTP Login
1. Enter valid E.164 phone and send OTP.
2. Enter OTP and verify.
3. Expected: redirect to `/my-trips` with active session.

## 4) My Trips Access Control
1. While logged out, open `/my-trips`.
2. Expected: redirect to `/login`.
3. While logged in, open `/my-trips`.
4. Expected: list or empty-state without 500.

## 5) Booking Visibility
1. Open `/my-trips/[booking_id]` for own booking.
2. Expected: booking details visible.
3. Open a different customer booking id.
4. Expected: not found / denied (no data leak).

## 6) Payment Sandbox + Webhook
1. Complete sandbox payment flow (if available).
2. Trigger webhook event from Razorpay dashboard.
3. Expected: payment status moves to paid/captured and lifecycle updates.

## 7) Documents Visibility
1. After successful booking lifecycle, open booking detail.
2. Expected: documents visible when generated.
3. If generation fails/missing: admin KPI `Missing Documents` increases.

## 8) Support Request Flow
1. Customer opens `/my-trips/[booking_id]/support` and submits request.
2. Expected: success response.
3. Admin opens `/admin/support-requests`.
4. Expected: submitted request visible with details.
