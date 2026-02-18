import { NextResponse } from "next/server";
import {
  getBookingById,
  getPaymentIntentById,
  transitionBookingStatus,
  updatePaymentStatus,
} from "@/lib/backend/store";
import {
  buildBookingConfirmedNotification,
  sendNotificationStub,
} from "@/lib/backend/notifications";

interface ConfirmPaymentBody {
  bookingId?: string;
  paymentIntentId?: string;
  providerPaymentId?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ConfirmPaymentBody;
    const bookingId = body.bookingId ?? "";
    const paymentIntentId = body.paymentIntentId ?? "";
    const providerPaymentId = body.providerPaymentId ?? "";

    if (!bookingId || !paymentIntentId) {
      return NextResponse.json(
        { error: "bookingId and paymentIntentId are required" },
        { status: 400 }
      );
    }

    const booking = await getBookingById(bookingId);
    if (!booking) {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    if (booking.status === "confirmed") {
      return NextResponse.json({
        booking,
        message: "Booking already confirmed",
      });
    }

    const paymentIntent = await getPaymentIntentById(paymentIntentId);
    if (!paymentIntent || paymentIntent.bookingId !== bookingId) {
      return NextResponse.json({ error: "Payment intent not found" }, { status: 404 });
    }

    const updatedPayment = await updatePaymentStatus(
      paymentIntentId,
      "succeeded",
      providerPaymentId || undefined
    );

    const paidTransition = await transitionBookingStatus(
      booking.id,
      "payment_received",
      {
        providerPaymentId: providerPaymentId || booking.providerPaymentId,
      }
    );
    if (!paidTransition.booking) {
      return NextResponse.json(
        { error: paidTransition.error ?? "Failed to update booking payment state" },
        { status: 400 }
      );
    }

    const confirmTransition = await transitionBookingStatus(booking.id, "confirmed", {
      providerPaymentId: providerPaymentId || booking.providerPaymentId,
    });
    if (!confirmTransition.booking) {
      return NextResponse.json(
        { error: confirmTransition.error ?? "Failed to confirm booking" },
        { status: 400 }
      );
    }
    await sendNotificationStub(
      buildBookingConfirmedNotification(confirmTransition.booking)
    );

    return NextResponse.json({
      paymentIntent: updatedPayment,
      booking: confirmTransition.booking,
      message: "Booking confirmed",
    });
  } catch (error: unknown) {
    console.error("PAYMENT CONFIRM ERROR:", error);
    return NextResponse.json({ error: "Failed to confirm payment" }, { status: 500 });
  }
}
