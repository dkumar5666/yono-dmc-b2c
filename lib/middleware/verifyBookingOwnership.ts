import { NextResponse } from "next/server";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";
import { AuthRole } from "@/lib/auth/getUserRoleFromJWT";
import { routeError } from "@/lib/middleware/routeError";

interface BookingOwnershipInput {
  bookingId: string;
  role: AuthRole | null;
  userId: string | null;
  allowSupplier?: boolean;
}

export async function getCustomerIdByUserId(userId: string): Promise<string | null> {
  const db = new SupabaseRestClient();
  const query = new URLSearchParams();
  query.set("user_id", `eq.${userId}`);
  query.set("select", "id");
  const row = await db.selectSingle<{ id: string }>("customers", query);
  return row?.id ?? null;
}

export async function getSupplierIdByUserId(userId: string): Promise<string | null> {
  const db = new SupabaseRestClient();
  const query = new URLSearchParams();
  query.set("user_id", `eq.${userId}`);
  query.set("select", "id");
  const row = await db.selectSingle<{ id: string }>("suppliers", query);
  return row?.id ?? null;
}

export async function verifyBookingOwnership(
  input: BookingOwnershipInput
): Promise<NextResponse | null> {
  const { bookingId, role, userId, allowSupplier = false } = input;
  if (role === "admin") return null;
  if (!userId || !role) return routeError(401, "Not authenticated");

  const db = new SupabaseRestClient();
  const bookingQuery = new URLSearchParams();
  bookingQuery.set("id", `eq.${bookingId}`);
  bookingQuery.set("select", "id,customer_id");
  const booking = await db.selectSingle<{ id: string; customer_id: string | null }>(
    "bookings",
    bookingQuery
  );
  if (!booking) return routeError(404, "Booking not found");

  if (role === "customer") {
    const customerId = await getCustomerIdByUserId(userId);
    if (!customerId) return routeError(403, "Not authorized");
    if (booking.customer_id !== customerId) return routeError(403, "Not authorized");
    return null;
  }

  if (role === "supplier" && allowSupplier) {
    const supplierId = await getSupplierIdByUserId(userId);
    if (!supplierId) return routeError(403, "Not authorized");

    const itemQuery = new URLSearchParams();
    itemQuery.set("booking_id", `eq.${bookingId}`);
    itemQuery.set("supplier_id", `eq.${supplierId}`);
    itemQuery.set("select", "id");
    const linkedItem = await db.selectSingle<{ id: string }>("booking_items", itemQuery);
    if (!linkedItem) return routeError(403, "Not authorized");
    return null;
  }

  return routeError(403, "Not authorized");
}

