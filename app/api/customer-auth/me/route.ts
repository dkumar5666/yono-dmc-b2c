import { getCustomerSessionFromRequest } from "@/lib/backend/customerAuth";
import { getCustomerById } from "@/lib/backend/customerStore";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  safeLog(
    "auth.customer.me.requested",
    {
      requestId,
      route: "/api/customer-auth/me",
    },
    req
  );

  const session = getCustomerSessionFromRequest(req);
  if (!session) {
    safeLog(
      "auth.customer.me.failed",
      {
        requestId,
        route: "/api/customer-auth/me",
        outcome: "fail",
        reason: "unauthorized_no_session",
      },
      req
    );
    const response = apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const customer = getCustomerById(session.id);
  if (!customer) {
    safeLog(
      "auth.customer.me.failed",
      {
        requestId,
        route: "/api/customer-auth/me",
        outcome: "fail",
        reason: "unauthorized_customer_not_found",
      },
      req
    );
    const response = apiError(req, 401, "UNAUTHORIZED", "Unauthorized");
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const response = apiSuccess(req, {
    user: {
      id: customer.id,
      name: customer.fullName,
      email: customer.email,
      phone: customer.phone,
      provider: customer.provider,
    },
  });
  response.headers.set("x-request-id", requestId);
  safeLog(
    "auth.customer.me.success",
    {
      requestId,
      route: "/api/customer-auth/me",
      outcome: "success",
    },
    req
  );
  return response;
}
