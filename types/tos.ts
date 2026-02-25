export type BookingLifecycleStatus =
  | "lead_created"
  | "quotation_sent"
  | "quotation_approved"
  | "booking_created"
  | "payment_pending"
  | "payment_confirmed"
  | "supplier_confirmed"
  | "documents_generated"
  | "completed"
  | "cancelled"
  | "refunded";

export type ActorType = "system" | "customer" | "admin" | "supplier" | "webhook";

export type PaymentProvider = "razorpay" | "stripe" | "manual" | "bank_transfer";

export type PaymentStatus =
  | "created"
  | "requires_action"
  | "authorized"
  | "captured"
  | "failed"
  | "cancelled"
  | "partially_refunded"
  | "refunded";

export type DocumentType =
  | "invoice"
  | "voucher"
  | "itinerary"
  | "ticket"
  | "visa"
  | "insurance"
  | "other";

export interface TosBooking {
  id: string;
  booking_code: string;
  customer_id: string;
  trip_id: string | null;
  lead_id: string | null;
  quotation_id: string | null;
  booking_channel: "web" | "admin" | "api" | "agent";
  booking_mode: "ota" | "dmc" | "mixed";
  lifecycle_status: BookingLifecycleStatus;
  payment_status: string;
  supplier_status: string;
  currency_code: string;
  gross_amount: number;
  net_amount: number;
  paid_amount: number;
  due_amount: number;
  refund_amount: number;
  travel_start_date: string | null;
  travel_end_date: string | null;
  pnr_primary: string | null;
  supplier_confirmation_reference: string | null;
  external_reference: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TosPayment {
  id: string;
  booking_id: string;
  customer_id: string | null;
  provider: PaymentProvider;
  idempotency_key: string | null;
  webhook_event_id: string | null;
  provider_order_id: string | null;
  provider_payment_intent_id: string | null;
  provider_payment_id: string | null;
  provider_signature: string | null;
  currency_code: string;
  amount: number;
  amount_captured: number;
  amount_refunded: number;
  status: PaymentStatus;
  paid_at: string | null;
  failed_reason: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TosDocument {
  id: string;
  booking_id: string | null;
  quotation_id: string | null;
  customer_id: string | null;
  type: DocumentType;
  status: "generated" | "uploaded" | "failed" | "archived";
  version: number;
  storage_bucket: string | null;
  storage_path: string | null;
  public_url: string | null;
  mime_type: string | null;
  checksum: string | null;
  generated_by: string | null;
  generated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface TosLifecycleEvent {
  id: string;
  booking_id: string;
  from_status: BookingLifecycleStatus | null;
  to_status: BookingLifecycleStatus;
  event_name: string;
  actor_type: ActorType;
  actor_id: string | null;
  idempotency_key: string | null;
  note: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TransitionBookingLifecycleInput {
  bookingId: string;
  toStatus: BookingLifecycleStatus;
  actorType: ActorType;
  actorId?: string | null;
  note?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface TransitionBookingLifecycleResult {
  booking: TosBooking;
  event: TosLifecycleEvent | null;
  changed: boolean;
}

export interface CreatePaymentIntentInput {
  bookingId: string;
  amount?: number;
  currencyCode?: string;
  provider: PaymentProvider;
  idempotencyKey?: string;
  customerId?: string;
}

export interface CreatePaymentIntentResult {
  payment: TosPayment;
  providerPayload: Record<string, unknown>;
}

export interface PaymentWebhookPayload {
  provider: PaymentProvider;
  eventId: string;
  eventType: string;
  bookingId: string;
  providerPaymentId?: string;
  providerOrderId?: string;
  providerPaymentIntentId?: string;
  amountCaptured?: number;
  amountRefunded?: number;
  currencyCode?: string;
  rawPayload: Record<string, unknown>;
}

export interface GenerateDocumentInput {
  bookingId: string;
  customerId?: string | null;
  generatedBy?: string | null;
  type: DocumentType;
  fileNamePrefix?: string;
  payload: Record<string, unknown>;
}
