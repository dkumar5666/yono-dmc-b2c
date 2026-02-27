import { NextResponse } from "next/server";
import { BookingPayload, BookingStatus } from "@/lib/backend/types";
import { createBooking, listBookings } from "@/lib/backend/store";
import {
  buildBookingCreatedNotification,
  sendNotificationStub,
} from "@/lib/backend/notifications";
import { validateBookingPayload } from "@/lib/backend/validation";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";
import { getCustomerIdByUserId } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";

const bookingStatuses: BookingStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "confirmed",
  "failed",
  "cancelled",
];

export async function GET(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const { searchParams } = new URL(req.url);
    const statusParam = searchParams.get("status") ?? undefined;
    const from = searchParams.get("from") ?? undefined;
    const to = searchParams.get("to") ?? undefined;

    const status = statusParam as BookingStatus | undefined;
    if (status && !bookingStatuses.includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status filter" }, { status: 400 });
    }

    if (auth.role === "customer") {
      if (!auth.userId) return routeError(401, "Not authenticated");
      const customerId = await getCustomerIdByUserId(auth.userId);
      if (!customerId) return routeError(403, "Not authorized");

      const db = new SupabaseRestClient();
      const query = new URLSearchParams();
      query.set("customer_id", `eq.${customerId}`);
      query.set("select", "*");
      query.set("order", "created_at.desc");
      const bookings = await db.selectMany<Record<string, unknown>>("bookings", query);
      return NextResponse.json({ bookings });
    }

    const bookings = await listBookings({ status, from, to });
    return NextResponse.json({ bookings });
  } catch (error: unknown) {
    console.error("BOOKINGS LIST ERROR:", error);
    return routeError(500, "Failed to list bookings");
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json()) as Partial<BookingPayload>;
    const safeOfferSnapshot =
      body.offerSnapshot && typeof body.offerSnapshot === "object"
        ? body.offerSnapshot
        : null;
    const payload: BookingPayload = {
      type: "flight",
      offerId: (body.offerId ?? "").trim(),
      offerSnapshot: safeOfferSnapshot,
      amount: body.amount ?? 0,
      currency: (body.currency ?? "INR").toUpperCase().slice(0, 5),
      contact: {
        name: (body.contact?.name ?? "").trim(),
        email: (body.contact?.email ?? "").trim().toLowerCase(),
        phone: (body.contact?.phone ?? "").trim(),
      },
      travelers: (body.travelers ?? []).map((traveler) => ({
        firstName: traveler.firstName?.trim() ?? "",
        lastName: traveler.lastName?.trim() ?? "",
        dob: traveler.dob?.trim(),
        gender: traveler.gender,
        passportNumber: traveler.passportNumber?.trim(),
      })),
      notes: body.notes?.trim().slice(0, 1000),
    };

    const validationError = validateBookingPayload(payload);
    if (validationError) {
      return NextResponse.json({ success: false, error: validationError }, { status: 400 });
    }

    const booking = await createBooking(payload);
    await sendNotificationStub(buildBookingCreatedNotification(booking));
    return NextResponse.json({ booking }, { status: 201 });
  } catch (error: unknown) {
    console.error("BOOKING CREATE ERROR:", error);
    return routeError(500, "Failed to create booking");
  }
}

