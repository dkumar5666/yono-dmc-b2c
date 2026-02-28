import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type LogOutcome = "success" | "fail" | "warn";

interface RouteDurationPayload {
  route: string;
  durationMs: number;
  statusCode: number;
  outcome: LogOutcome;
}

interface AnalyticsEventPayload {
  event: string;
  leadId?: string | null;
  bookingId?: string | null;
  paymentId?: string | null;
  source?: string | null;
  status?: string | null;
  meta?: Record<string, unknown>;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeMeta(input: unknown): Record<string, unknown> {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  const source = input as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(source)) {
    if (value == null) continue;
    if (typeof value === "string") out[key] = value.slice(0, 400);
    else if (typeof value === "number" || typeof value === "boolean") out[key] = value;
    else if (Array.isArray(value)) out[key] = value.slice(0, 20);
  }
  return out;
}

async function insertSystemLog(payload: Record<string, unknown>): Promise<void> {
  try {
    const db = new SupabaseRestClient();
    const attempts: Array<Record<string, unknown>> = [
      payload,
      {
        level: payload.level,
        event: payload.event,
        message: payload.message,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        booking_id: payload.booking_id,
        payment_id: payload.payment_id,
        meta: payload.meta,
      },
      {
        event: payload.event,
        message: payload.message,
        meta: payload.meta,
      },
      {
        message: payload.message,
      },
    ];

    for (const candidate of attempts) {
      try {
        await db.insertSingle("system_logs", candidate);
        return;
      } catch {
        // Try narrower payload variant.
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
  }
}

export async function recordRouteDuration(payload: RouteDurationPayload): Promise<void> {
  const durationMs = Math.max(0, Math.round(Number(payload.durationMs) || 0));
  const route = safeString(payload.route) || "unknown_route";
  await insertSystemLog({
    level: payload.outcome === "fail" ? "warn" : "info",
    event: "perf.route",
    message: `route=${route} duration_ms=${durationMs}`,
    meta: {
      route,
      duration_ms: durationMs,
      status_code: payload.statusCode,
      outcome: payload.outcome,
    },
  });
}

export async function recordAnalyticsEvent(payload: AnalyticsEventPayload): Promise<void> {
  const event = safeString(payload.event);
  if (!event) return;

  await insertSystemLog({
    level: "info",
    event: `analytics.${event}`,
    entity_type: payload.leadId ? "lead" : payload.bookingId ? "booking" : payload.paymentId ? "payment" : null,
    entity_id: payload.leadId || payload.bookingId || payload.paymentId || null,
    booking_id: payload.bookingId || null,
    payment_id: payload.paymentId || null,
    message: `analytics event: ${event}`,
    meta: sanitizeMeta({
      source: payload.source,
      status: payload.status,
      ...payload.meta,
    }),
  });
}
