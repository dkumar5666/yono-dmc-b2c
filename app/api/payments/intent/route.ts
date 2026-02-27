import { NextResponse } from "next/server";
import {
  createPaymentIntent,
  getBookingById,
  transitionBookingStatus,
} from "@/lib/backend/store";
import { getPaymentProvider } from "@/lib/backend/paymentProvider";
import { requireRole } from "@/lib/middleware/requireRole";
import { verifyBookingOwnership } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";

interface CreatePaymentIntentBody {
  bookingId?: string;
  amount?: number;
  currency?: string;
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json()) as CreatePaymentIntentBody;
    const bookingId = body.bookingId ?? "";

    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required" }, { status: 400 });
    }
    const ownershipError = await verifyBookingOwnership({
      bookingId,
      role: auth.role,
      userId: auth.userId,
    });
    if (ownershipError) return ownershipError;

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return routeError(404, "Booking not found");
    }
    if (booking.status === "confirmed" || booking.status === "cancelled") {
      return NextResponse.json(
        { success: false, error: `Cannot create payment intent for ${booking.status} booking` },
        { status: 400 }
      );
    }

    const amount = body.amount ?? booking.amount;
    const currency = body.currency ?? booking.currency;
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, error: "Invalid amount" }, { status: 400 });
    }
    if (amount !== booking.amount || currency !== booking.currency) {
      return NextResponse.json(
        { success: false, error: "Amount/currency mismatch with booking" },
        { status: 400 }
      );
    }

    const provider = getPaymentProvider();
    const providerIntent = await provider.createIntent({
      bookingId: booking.id,
      amount,
      currency,
    });

    const intent = await createPaymentIntent({
      bookingId: booking.id,
      amount,
      currency,
    });

    const transition = await transitionBookingStatus(booking.id, "pending_payment", {
      paymentIntentId: intent.id,
    });
    if (!transition.booking) {
      return NextResponse.json(
        { success: false, error: transition.error ?? "Failed to update booking state" },
        { status: 400 }
      );
    }

    return NextResponse.json({
      paymentIntent: intent,
      booking: transition.booking,
      provider: {
        name: providerIntent.provider,
        clientSecret: providerIntent.providerClientSecret,
      },
      message: "Use /api/payments/confirm to complete booking after payment.",
    });
  } catch (error: unknown) {
    console.error("PAYMENT INTENT ERROR:", error);
    return routeError(500, "Failed to create payment intent");
  }
}

