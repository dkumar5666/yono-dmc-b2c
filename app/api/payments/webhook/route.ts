import { apiError, apiSuccess } from "@/lib/backend/http";
import {
  handlePaymentWebhook,
  verifyPaymentWebhookSignature,
} from "@/lib/services/payment.service";
import { PaymentProvider } from "@/types/tos";

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function getNestedString(obj: Record<string, unknown>, path: string[]): string | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "string" ? current : undefined;
}

function getNestedNumber(obj: Record<string, unknown>, path: string[]): number | undefined {
  let current: unknown = obj;
  for (const key of path) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return typeof current === "number" ? current : undefined;
}

function normalizeProvider(value: string | null): PaymentProvider | null {
  if (!value) return null;
  const normalized = value.toLowerCase();
  if (normalized === "razorpay") return "razorpay";
  if (normalized === "stripe") return "stripe";
  if (normalized === "manual") return "manual";
  if (normalized === "bank_transfer") return "bank_transfer";
  return null;
}

export async function POST(req: Request) {
  try {
    const requestUrl = new URL(req.url);
    const provider =
      normalizeProvider(requestUrl.searchParams.get("provider")) ??
      normalizeProvider(req.headers.get("x-payment-provider")) ??
      "razorpay";

    const rawBody = await req.text();
    if (!verifyPaymentWebhookSignature(provider, rawBody, req.headers)) {
      return apiError(req, 401, "INVALID_WEBHOOK_SIGNATURE", "Invalid webhook signature.");
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return apiError(req, 400, "INVALID_JSON", "Invalid webhook JSON payload.");
    }

    const payload = asRecord(parsed);
    const eventId =
      getNestedString(payload, ["eventId"]) ??
      getNestedString(payload, ["id"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "id"]) ??
      `evt_${Date.now()}`;
    const eventType =
      getNestedString(payload, ["eventType"]) ??
      getNestedString(payload, ["event"]) ??
      getNestedString(payload, ["type"]) ??
      "payment.updated";

    const bookingId =
      getNestedString(payload, ["bookingId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "notes", "bookingId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "notes", "booking_id"]);

    if (!bookingId) {
      return apiError(
        req,
        400,
        "BOOKING_ID_MISSING",
        "bookingId is required in webhook payload."
      );
    }

    const providerPaymentId =
      getNestedString(payload, ["providerPaymentId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "id"]);
    const providerOrderId =
      getNestedString(payload, ["providerOrderId"]) ??
      getNestedString(payload, ["payload", "payment", "entity", "order_id"]);
    const providerPaymentIntentId = getNestedString(payload, ["providerPaymentIntentId"]);

    const amountCaptured =
      getNestedNumber(payload, ["amountCaptured"]) ??
      getNestedNumber(payload, ["amount"]) ??
      getNestedNumber(payload, ["payload", "payment", "entity", "amount"]);
    const amountRefunded =
      getNestedNumber(payload, ["amountRefunded"]) ??
      getNestedNumber(payload, ["payload", "refund", "entity", "amount"]);

    const result = await handlePaymentWebhook({
      provider,
      eventId,
      eventType,
      bookingId,
      providerPaymentId,
      providerOrderId,
      providerPaymentIntentId,
      amountCaptured,
      amountRefunded,
      currencyCode:
        getNestedString(payload, ["currencyCode"]) ??
        getNestedString(payload, ["payload", "payment", "entity", "currency"]),
      rawPayload: payload,
    });

    return apiSuccess(req, result, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Supabase is not configured")) {
      return apiError(
        req,
        503,
        "SUPABASE_NOT_CONFIGURED",
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }

    if (message.includes("Booking not found")) {
      return apiError(req, 404, "BOOKING_NOT_FOUND", message);
    }

    return apiError(req, 500, "PAYMENT_WEBHOOK_FAILED", "Failed to process payment webhook.", {
      message,
    });
  }
}
