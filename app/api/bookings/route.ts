import { NextResponse } from "next/server";
import { BookingPayload, BookingStatus } from "@/lib/backend/types";
import { createBooking, listBookings } from "@/lib/backend/store";
import {
  buildBookingCreatedNotification,
  sendNotificationStub,
} from "@/lib/backend/notifications";
import { requireAdmin } from "@/lib/backend/adminAuth";
import { validateBookingPayload } from "@/lib/backend/validation";

const bookingStatuses: BookingStatus[] = [
  "initiated",
  "pending_payment",
  "payment_received",
  "confirmed",
  "failed",
  "cancelled",
];

export async function GET(req: Request) {
  try {
    const authError = requireAdmin(req);
    if (authError) return authError;

    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const status = statusParam as BookingStatus | undefined;
    if (status && !bookingStatuses.includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const bookings = await listBookings({ status, from, to });
    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    console.error("BOOKINGS LIST ERROR:", error);
    return NextResponse.json({ error: "Failed to list bookings" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<BookingPayload>;
    const payload: BookingPayload = {
      type: "flight",
      offerId: body.offerId ?? "",
      offerSnapshot: body.offerSnapshot ?? null,
      amount: body.amount ?? 0,
      currency: body.currency ?? "INR",
      contact: {
        name: body.contact?.name ?? "",
        email: body.contact?.email ?? "",
        phone: body.contact?.phone ?? "",
      },
      travelers: body.travelers ?? [],
      notes: body.notes,
    };

    const validationError = validateBookingPayload(payload);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const booking = await createBooking(payload);
    await sendNotificationStub(buildBookingCreatedNotification(booking));
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    console.error("BOOKING CREATE ERROR:", error);
    return NextResponse.json({ error: "Failed to create booking" }, { status: 500 });
  }
}
