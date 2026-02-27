import crypto from "node:crypto";

type SafeMeta = Record<string, unknown>;

const REDACT_KEYS = ["token", "secret", "cookie", "otp", "code", "password"];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return REDACT_KEYS.some((part) => lower.includes(part));
}

function sanitizeValue(value: unknown, depth = 0): unknown {
  if (depth > 3) return "[truncated]";
  if (value == null) return value;
  if (typeof value === "string") {
    return value.length > 300 ? `${value.slice(0, 300)}...` : value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeValue(item, depth + 1));
  }
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      out[key] = isSensitiveKey(key) ? "[redacted]" : sanitizeValue(nested, depth + 1);
    }
    return out;
  }
  return String(value);
}

export function getRequestId(req: Request): string {
  const fromHeader = req.headers.get("x-request-id")?.trim();
  if (fromHeader) return fromHeader.slice(0, 64);
  return crypto.randomUUID().slice(0, 12);
}

export function safeLog(event: string, meta: SafeMeta, req?: Request): void {
  const safeMeta = sanitizeValue(meta) as Record<string, unknown>;
  const payload: Record<string, unknown> = {
    event,
    ...safeMeta,
  };

  if (req) {
    try {
      const url = new URL(req.url);
      payload.host = req.headers.get("x-forwarded-host") || req.headers.get("host");
      payload.path = url.pathname;
    } catch {
      payload.path = "unknown";
    }
  }

  const message = JSON.stringify(payload);
  if (process.env.NODE_ENV === "production") {
    console.log(message);
  } else {
    console.log(`[safe-log] ${message}`);
  }
}
