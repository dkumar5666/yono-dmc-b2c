import { apiSuccess } from "@/lib/backend/http";
import { transitionBookingLifecycle } from "@/lib/core/booking-lifecycle.engine";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  ActorType,
  BookingLifecycleStatus,
  TransitionBookingLifecycleInput,
} from "@/types/tos";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";

interface TransitionBody {
  bookingId?: string;
  toStatus?: BookingLifecycleStatus;
  actorType?: ActorType;
  actorId?: string;
  note?: string;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

function isLifecycleStatus(value: string): value is BookingLifecycleStatus {
  return [
    "lead_created",
    "quotation_sent",
    "quotation_approved",
    "booking_created",
    "payment_pending",
    "payment_confirmed",
    "supplier_confirmed",
    "documents_generated",
    "completed",
    "cancelled",
    "refunded",
  ].includes(value);
}

function isActorType(value: string): value is ActorType {
  return ["system", "customer", "admin", "supplier", "webhook"].includes(value);
}

export async function POST(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json()) as TransitionBody;
    const bookingId = (body.bookingId ?? "").trim();
    const toStatus = body.toStatus;
    const actorType = body.actorType ?? "system";

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required." }, { status: 400 });
    }
    if (!toStatus || !isLifecycleStatus(toStatus)) {
      return NextResponse.json({ success: false, error: "A valid toStatus is required." }, { status: 400 });
    }
    if (!isActorType(actorType)) {
      return NextResponse.json({ success: false, error: "Invalid actorType." }, { status: 400 });
    }

    const input: TransitionBookingLifecycleInput = {
      bookingId,
      toStatus,
      actorType,
      actorId: body.actorId ?? null,
      note: body.note,
      idempotencyKey: body.idempotencyKey,
      metadata: body.metadata ?? {},
    };

    const result = await transitionBookingLifecycle(input);
    return apiSuccess(req, result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Supabase is not configured")) {
      return routeError(500, "Supabase is not configured.");
    }
    if (message.includes("Invalid lifecycle transition")) {
      return NextResponse.json({ success: false, error: message }, { status: 400 });
    }
    if (message.includes("Booking not found")) {
      return routeError(404, "Booking not found");
    }
    return routeError(500, "Lifecycle update failed");
  }
}
