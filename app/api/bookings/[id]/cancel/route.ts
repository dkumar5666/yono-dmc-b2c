import { NextResponse } from "next/server";
import { getBookingById, transitionBookingStatus } from "@/lib/backend/store";
import { requireAdmin } from "@/lib/backend/adminAuth";

interface CancelBookingBody {
  reason?: string;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const params = "then" in context.params ? await context.params : context.params;
    const booking = await getBookingById(params.id);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }

    const body = (await req.json()) as CancelBookingBody;
    const reason = body.reason?.trim() || "Cancelled by user";

    const transition = await transitionBookingStatus(booking.id, "cancelled", {
      cancellationReason: reason,
      cancelledAt: booking.cancelledAt ?? new Date().toISOString(),
    });

    if (!transition.booking) {
      return NextResponse.json(
        { error: transition.error ?? "Unable to cancel booking" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      booking: transition.booking,
      message: "Booking cancelled successfully",
    });
  } catch (error: unknown) {
    console.error("BOOKING CANCEL ERROR:", error);
    return NextResponse.json({ error: "Failed to cancel booking" }, { status: 500 });
  }
}
