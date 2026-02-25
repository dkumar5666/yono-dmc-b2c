import { NextResponse } from "next/server";
import { BookingStatus } from "@/lib/backend/types";
import {
  getBookingById,
  transitionBookingStatus,
  updateBookingFields,
} from "@/lib/backend/store";
import { requireRole } from "@/lib/middleware/requireRole";
import { verifyBookingOwnership } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = requireRole(req, ["customer", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const ownershipError = await verifyBookingOwnership({
      bookingId: params.id,
      role: auth.role,
      userId: auth.userId,
    });
    if (ownershipError) return ownershipError;

    const booking = await getBookingById(params.id);
    if (!booking) {
      return routeError(404, "Booking not found");
    }
    return NextResponse.json({ booking });
  } catch (error: unknown) {
    console.error("BOOKING FETCH ERROR:", error);
    return routeError(500, "Failed to fetch booking");
  }
}

interface BookingPatchBody {
  status?: BookingStatus;
  pnr?: string;
  ticketNumbers?: string[];
  issuedAt?: string;
  issuedBy?: string;
  cancellationReason?: string;
  notes?: string;
}

const bookingStatuses: BookingStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "failed",
  "cancelled",
];

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = requireRole(req, ["customer", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const ownershipError = await verifyBookingOwnership({
      bookingId: params.id,
      role: auth.role,
      userId: auth.userId,
    });
    if (ownershipError) return ownershipError;
    if (auth.role === "customer") return routeError(403, "Not authorized");

    const booking = await getBookingById(params.id);
    if (!booking) {
      return routeError(404, "Booking not found");
    }

    const body = (await req.json()) as BookingPatchBody;
    const { status, pnr, ticketNumbers, issuedAt, issuedBy, cancellationReason, notes } =
      body;

    if (status && !bookingStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid booking status" }, { status: 400 });
    }

    if (status) {
      const transition = await transitionBookingStatus(booking.id, status, {
        pnr: pnr ?? booking.pnr,
        ticketNumbers: ticketNumbers ?? booking.ticketNumbers,
        issuedAt: issuedAt ?? booking.issuedAt,
        issuedBy: issuedBy ?? booking.issuedBy,
        cancellationReason: cancellationReason ?? booking.cancellationReason,
        cancelledAt:
          status === "cancelled"
            ? booking.cancelledAt ?? new Date().toISOString()
            : booking.cancelledAt,
        notes: notes ?? booking.notes,
      });

      if (!transition.booking) {
        return NextResponse.json(
          { success: false, error: transition.error ?? "Status update failed" },
          { status: 400 }
        );
      }

      return NextResponse.json({ booking: transition.booking });
    }

    const updated = await updateBookingFields(booking.id, {
      pnr: pnr ?? booking.pnr,
      ticketNumbers: ticketNumbers ?? booking.ticketNumbers,
      issuedAt: issuedAt ?? booking.issuedAt,
      issuedBy: issuedBy ?? booking.issuedBy,
      cancellationReason: cancellationReason ?? booking.cancellationReason,
      notes: notes ?? booking.notes,
    });

    return NextResponse.json({ booking: updated });
  } catch (error: unknown) {
    console.error("BOOKING PATCH ERROR:", error);
    return routeError(500, "Failed to update booking");
  }
}
