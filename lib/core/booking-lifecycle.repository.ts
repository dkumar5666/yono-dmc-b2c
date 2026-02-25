import { randomUUID } from "node:crypto";
import {
  BookingLifecycleStatus,
  TosBooking,
  TosLifecycleEvent,
  TosPayment,
  TosDocument,
} from "@/types/tos";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";

export interface BookingLifecycleRepository {
  getBookingById(bookingId: string): Promise<TosBooking | null>;
  updateBookingLifecycleStatus(
    bookingId: string,
    lifecycleStatus: BookingLifecycleStatus,
    metadata?: Record<string, unknown>
  ): Promise<TosBooking>;
  findLifecycleEventByIdempotencyKey(
    bookingId: string,
    idempotencyKey: string
  ): Promise<TosLifecycleEvent | null>;
  createLifecycleEvent(payload: {
    bookingId: string;
    fromStatus: BookingLifecycleStatus | null;
    toStatus: BookingLifecycleStatus;
    eventName: string;
    actorType: "system" | "customer" | "admin" | "supplier" | "webhook";
    actorId?: string | null;
    idempotencyKey?: string | null;
    note?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TosLifecycleEvent>;
}

export class SupabaseBookingLifecycleRepository implements BookingLifecycleRepository {
  constructor(private readonly db = new SupabaseRestClient()) {}

  async getBookingById(bookingId: string): Promise<TosBooking | null> {
    const query = new URLSearchParams();
    query.set("id", `eq.${bookingId}`);
    query.set("select", "*");
    return this.db.selectSingle<TosBooking>("bookings", query);
  }

  async updateBookingLifecycleStatus(
    bookingId: string,
    lifecycleStatus: BookingLifecycleStatus,
    metadata?: Record<string, unknown>
  ): Promise<TosBooking> {
    const query = new URLSearchParams();
    query.set("id", `eq.${bookingId}`);
    query.set("select", "*");

    const patch: Record<string, unknown> = {
      lifecycle_status: lifecycleStatus,
      metadata: metadata ?? {},
    };
    if (lifecycleStatus === "completed") patch.completed_at = new Date().toISOString();
    if (lifecycleStatus === "cancelled") patch.cancelled_at = new Date().toISOString();

    const updated = await this.db.updateSingle<TosBooking>("bookings", query, patch);
    if (!updated) {
      throw new Error(`Booking not found for lifecycle update: ${bookingId}`);
    }
    return updated;
  }

  async findLifecycleEventByIdempotencyKey(
    bookingId: string,
    idempotencyKey: string
  ): Promise<TosLifecycleEvent | null> {
    const query = new URLSearchParams();
    query.set("booking_id", `eq.${bookingId}`);
    query.set("idempotency_key", `eq.${idempotencyKey}`);
    query.set("select", "*");
    return this.db.selectSingle<TosLifecycleEvent>("booking_lifecycle_events", query);
  }

  async createLifecycleEvent(payload: {
    bookingId: string;
    fromStatus: BookingLifecycleStatus | null;
    toStatus: BookingLifecycleStatus;
    eventName: string;
    actorType: "system" | "customer" | "admin" | "supplier" | "webhook";
    actorId?: string | null;
    idempotencyKey?: string | null;
    note?: string;
    metadata?: Record<string, unknown>;
  }): Promise<TosLifecycleEvent> {
    return this.db.insertSingle<TosLifecycleEvent>("booking_lifecycle_events", {
      id: randomUUID(),
      booking_id: payload.bookingId,
      from_status: payload.fromStatus,
      to_status: payload.toStatus,
      event_name: payload.eventName,
      actor_type: payload.actorType,
      actor_id: payload.actorId ?? null,
      idempotency_key: payload.idempotencyKey ?? null,
      note: payload.note ?? null,
      metadata: payload.metadata ?? {},
    });
  }
}

export interface PaymentsRepository {
  createPayment(payload: Record<string, unknown>): Promise<TosPayment>;
  getPaymentByWebhookEventId(eventId: string): Promise<TosPayment | null>;
  getPaymentByIdempotencyKey(idempotencyKey: string): Promise<TosPayment | null>;
  getPaymentById(paymentId: string): Promise<TosPayment | null>;
  getLatestPaymentByBookingId(bookingId: string): Promise<TosPayment | null>;
  updatePayment(paymentId: string, patch: Record<string, unknown>): Promise<TosPayment>;
}

export class SupabasePaymentsRepository implements PaymentsRepository {
  constructor(private readonly db = new SupabaseRestClient()) {}

  async createPayment(payload: Record<string, unknown>): Promise<TosPayment> {
    return this.db.insertSingle<TosPayment>("payments", payload);
  }

  async getPaymentByWebhookEventId(eventId: string): Promise<TosPayment | null> {
    const query = new URLSearchParams();
    query.set("webhook_event_id", `eq.${eventId}`);
    query.set("select", "*");
    return this.db.selectSingle<TosPayment>("payments", query);
  }

  async getPaymentByIdempotencyKey(idempotencyKey: string): Promise<TosPayment | null> {
    const query = new URLSearchParams();
    query.set("idempotency_key", `eq.${idempotencyKey}`);
    query.set("select", "*");
    return this.db.selectSingle<TosPayment>("payments", query);
  }

  async getPaymentById(paymentId: string): Promise<TosPayment | null> {
    const query = new URLSearchParams();
    query.set("id", `eq.${paymentId}`);
    query.set("select", "*");
    return this.db.selectSingle<TosPayment>("payments", query);
  }

  async getLatestPaymentByBookingId(bookingId: string): Promise<TosPayment | null> {
    const query = new URLSearchParams();
    query.set("booking_id", `eq.${bookingId}`);
    query.set("select", "*");
    query.set("order", "created_at.desc");
    return this.db.selectSingle<TosPayment>("payments", query);
  }

  async updatePayment(paymentId: string, patch: Record<string, unknown>): Promise<TosPayment> {
    const query = new URLSearchParams();
    query.set("id", `eq.${paymentId}`);
    query.set("select", "*");
    const updated = await this.db.updateSingle<TosPayment>("payments", query, patch);
    if (!updated) throw new Error(`Payment not found: ${paymentId}`);
    return updated;
  }
}

export interface DocumentsRepository {
  createDocument(payload: Record<string, unknown>): Promise<TosDocument>;
}

export class SupabaseDocumentsRepository implements DocumentsRepository {
  constructor(private readonly db = new SupabaseRestClient()) {}

  async createDocument(payload: Record<string, unknown>): Promise<TosDocument> {
    return this.db.insertSingle<TosDocument>("documents", payload);
  }
}
