import { NextResponse } from "next/server";
import { clearCustomerSessionCookie } from "@/lib/backend/customerAuth";
import { getRequestId, safeLog } from "@/lib/system/requestContext";
import { clearSupabaseSessionCookie } from "@/lib/auth/supabaseSession";

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  safeLog(
    "auth.customer.logout.requested",
    {
      requestId,
      route: "/api/customer-auth/logout",
    },
    req
  );

  try {
    const response = NextResponse.json({ ok: true });
    response.headers.set("x-request-id", requestId);
    clearCustomerSessionCookie(response);
    clearSupabaseSessionCookie(response);
    safeLog(
      "auth.customer.logout.success",
      {
        requestId,
        route: "/api/customer-auth/logout",
        outcome: "success",
      },
      req
    );
    return response;
  } catch (error) {
    safeLog(
      "auth.customer.logout.failed",
      {
        requestId,
        route: "/api/customer-auth/logout",
        outcome: "fail",
        reason: error instanceof Error ? error.message : "unknown_error",
      },
      req
    );
    return NextResponse.json({ ok: false, error: "logout_failed" }, { status: 500 });
  }
}
