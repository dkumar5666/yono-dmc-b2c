import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

interface AcquireWebhookLockResult {
  ok: boolean;
  skipped: boolean;
  reason?: string;
}

type WebhookPatchFields = {
  status?: string;
  booking_id?: string | null;
  payment_id?: string | null;
  payload?: unknown;
  event_type?: string | null;
};

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

function inferEventType(payload: unknown): string | null {
  const obj = asRecord(payload);
  return (
    getNestedString(obj, ["eventType"]) ??
    getNestedString(obj, ["event"]) ??
    getNestedString(obj, ["type"]) ??
    null
  );
}

function looksLikeUniqueViolation(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("23505") ||
    lower.includes("duplicate key") ||
    lower.includes("unique") && lower.includes("webhook_events") ||
    lower.includes("409")
  );
}

function looksLikeMissingTable(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("42p01") ||
    lower.includes("relation") && lower.includes("does not exist") ||
    lower.includes("webhook_events")
  );
}

export async function acquireWebhookLock(
  provider: string,
  eventId: string,
  payload?: unknown
): Promise<AcquireWebhookLockResult> {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedEventId = eventId.trim();
  if (!normalizedProvider || !normalizedEventId) {
    return { ok: false, skipped: false, reason: "invalid_lock_key" };
  }

  try {
    const db = new SupabaseRestClient();
    await db.insertSingle("webhook_events", {
      provider: normalizedProvider,
      event_id: normalizedEventId,
      event_type: inferEventType(payload),
      status: "processed",
      payload: payload ?? null,
    });
    return { ok: true, skipped: false };
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return { ok: false, skipped: false, reason: "supabase_not_configured" };
    }
    const message = error instanceof Error ? error.message : "Unknown lock error";
    if (looksLikeUniqueViolation(message)) {
      return { ok: true, skipped: true, reason: "duplicate_event" };
    }
    if (looksLikeMissingTable(message)) {
      return { ok: false, skipped: false, reason: "webhook_events_table_missing" };
    }
    return { ok: false, skipped: false, reason: "lock_insert_failed" };
  }
}

export async function markWebhookEvent(
  provider: string,
  eventId: string,
  patchFields: WebhookPatchFields
): Promise<void> {
  const normalizedProvider = provider.trim().toLowerCase();
  const normalizedEventId = eventId.trim();
  if (!normalizedProvider || !normalizedEventId) return;

  const payload: Record<string, unknown> = {};
  if (typeof patchFields.status === "string" && patchFields.status.trim()) {
    payload.status = patchFields.status.trim();
  }
  if (patchFields.booking_id !== undefined) payload.booking_id = patchFields.booking_id;
  if (patchFields.payment_id !== undefined) payload.payment_id = patchFields.payment_id;
  if (patchFields.payload !== undefined) payload.payload = patchFields.payload;
  if (patchFields.event_type !== undefined) payload.event_type = patchFields.event_type;
  if (Object.keys(payload).length === 0) return;

  try {
    const db = new SupabaseRestClient();
    await db.updateSingle(
      "webhook_events",
      new URLSearchParams({
        provider: `eq.${normalizedProvider}`,
        event_id: `eq.${normalizedEventId}`,
      }),
      payload
    );
  } catch {
    // best-effort only
  }
}

