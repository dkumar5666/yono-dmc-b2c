import { NextResponse } from "next/server";
import { getBookingById, transitionBookingStatus } from "@/lib/backend/store";
import { requireRole } from "@/lib/middleware/requireRole";
import { verifyBookingOwnership } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";

interface CancelBookingBody {
  reason?: string;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
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

    const body = (await req.json()) as CancelBookingBody;
    const reason = body.reason?.trim() || "Cancelled by user";

    const transition = await transitionBookingStatus(booking.id, "cancelled", {
      cancellationReason: reason,
      cancelledAt: booking.cancelledAt ?? new Date().toISOString(),
    });

    if (!transition.booking) {
      return NextResponse.json(
        { success: false, error: transition.error ?? "Unable to cancel booking" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      booking: transition.booking,
      message: "Booking cancelled successfully",
    });
  } catch (error: unknown) {
    console.error("BOOKING CANCEL ERROR:", error);
    return routeError(500, "Failed to cancel booking");
  }
}

