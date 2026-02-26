import "server-only";

import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

type HeartbeatKind = "cron_retry" | "payment_webhook" | "supplier_sync";

export async function writeHeartbeat(kind: HeartbeatKind, meta?: unknown) {
  try {
    const db = new SupabaseRestClient();

    try {
      await db.insertSingle("system_heartbeats", {
        kind,
        meta: meta ?? null,
      });
      return;
    } catch {
      // Fallback to system_logs if heartbeat table is not available.
    }

    const payloadVariants: Array<Record<string, unknown>> = [
      {
        level: "info",
        event: "heartbeat",
        message: kind,
        meta: meta ?? null,
      },
      {
        level: "info",
        message: kind,
        meta: meta ?? null,
      },
      {
        message: kind,
        meta: meta ?? null,
      },
    ];

    for (const payload of payloadVariants) {
      try {
        await db.insertSingle("system_logs", payload);
        return;
      } catch {
        // Try smaller payload variant.
      }
    }
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) return;
    return;
  }
}
