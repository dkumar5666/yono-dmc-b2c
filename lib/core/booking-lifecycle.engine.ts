import {
  BookingLifecycleStatus,
  TransitionBookingLifecycleInput,
  TransitionBookingLifecycleResult,
} from "@/types/tos";
import {
  BookingLifecycleRepository,
  SupabaseBookingLifecycleRepository,
} from "@/lib/core/booking-lifecycle.repository";
import { bookingEventDispatcher } from "@/lib/core/event-dispatcher";
import { ensureBookingAutomationHandlers } from "@/lib/core/booking-lifecycle.handlers";

const TRANSITIONS: Record<BookingLifecycleStatus, BookingLifecycleStatus[]> = {
  lead_created: ["quotation_sent", "cancelled"],
  quotation_sent: ["quotation_approved", "cancelled"],
  quotation_approved: ["booking_created", "cancelled"],
  booking_created: ["payment_pending", "cancelled"],
  payment_pending: ["payment_confirmed", "cancelled", "refunded"],
  payment_confirmed: ["supplier_confirmed", "cancelled", "refunded"],
  supplier_confirmed: ["documents_generated", "cancelled", "refunded"],
  documents_generated: ["completed", "cancelled", "refunded"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};

export function canTransitionLifecycle(
  current: BookingLifecycleStatus,
  next: BookingLifecycleStatus
): boolean {
  if (current === next) return true;
  return TRANSITIONS[current].includes(next);
}

export interface BookingLifecycleEngineDeps {
  repository: BookingLifecycleRepository;
}

function resolveDeps(deps?: Partial<BookingLifecycleEngineDeps>): BookingLifecycleEngineDeps {
  return {
    repository: deps?.repository ?? new SupabaseBookingLifecycleRepository(),
  };
}

export async function transitionBookingLifecycle(
  input: TransitionBookingLifecycleInput,
  deps?: Partial<BookingLifecycleEngineDeps>
): Promise<TransitionBookingLifecycleResult> {
  ensureBookingAutomationHandlers();
  const { repository } = resolveDeps(deps);

  const booking = await repository.getBookingById(input.bookingId);
  if (!booking) {
    throw new Error(`Booking not found: ${input.bookingId}`);
  }

  const current = booking.lifecycle_status;
  if (input.idempotencyKey) {
    const existing = await repository.findLifecycleEventByIdempotencyKey(
      input.bookingId,
      input.idempotencyKey
    );
    if (existing) {
      return {
        booking,
        event: existing,
        changed: false,
      };
    }
  }

  if (!canTransitionLifecycle(current, input.toStatus)) {
    throw new Error(`Invalid lifecycle transition: ${current} -> ${input.toStatus}`);
  }

  if (current === input.toStatus) {
    return {
      booking,
      event: null,
      changed: false,
    };
  }

  const updatedBooking = await repository.updateBookingLifecycleStatus(
    input.bookingId,
    input.toStatus,
    {
      ...(booking.metadata ?? {}),
      ...(input.metadata ?? {}),
    }
  );

  const event = await repository.createLifecycleEvent({
    bookingId: input.bookingId,
    fromStatus: current,
    toStatus: input.toStatus,
    eventName: `booking.${input.toStatus}`,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    idempotencyKey: input.idempotencyKey ?? null,
    note: input.note,
    metadata: input.metadata,
  });

  const payload = {
    booking: updatedBooking,
    previousStatus: current,
    nextStatus: input.toStatus,
    lifecycleEvent: event,
  };
  await bookingEventDispatcher.emit("booking.lifecycle.changed", payload);

  if (input.toStatus === "payment_confirmed") {
    await bookingEventDispatcher.emit("booking.payment_confirmed", payload);
  }
  if (input.toStatus === "supplier_confirmed") {
    await bookingEventDispatcher.emit("booking.supplier_confirmed", payload);
  }
  if (input.toStatus === "completed") {
    await bookingEventDispatcher.emit("booking.completed", payload);
  }

  return {
    booking: updatedBooking,
    event,
    changed: true,
  };
}
