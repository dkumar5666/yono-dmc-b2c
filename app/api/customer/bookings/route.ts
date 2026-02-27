import { apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { requireRole } from "@/lib/middleware/requireRole";
import { getCustomerIdByUserId } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const url = new URL(req.url);
    const requestedCustomerId = url.searchParams.get("customerId");

    let customerId = requestedCustomerId;
    if (auth.role === "customer") {
      if (!auth.userId) return routeError(401, "Not authenticated");
      customerId = await getCustomerIdByUserId(auth.userId);
      if (!customerId) return routeError(403, "Not authorized");
    } else if (!customerId) {
      return NextResponse.json({ success: false, error: "customerId is required." }, { status: 400 });
    }

    const db = new SupabaseRestClient();
    const query = new URLSearchParams();
    query.set("customer_id", `eq.${customerId}`);
    query.set("select", "*");
    query.set("order", "created_at.desc");

    const bookings = await db.selectMany<Record<string, unknown>>("bookings", query);
    return apiSuccess(req, { bookings });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(500, "Supabase is not configured.");
    }
    return routeError(500, "Failed to fetch customer bookings");
  }
}

