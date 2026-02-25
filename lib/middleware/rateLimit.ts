import { NextResponse } from "next/server";
import { consumeRateLimit, getClientIp } from "@/lib/backend/rateLimit";
import { routeError } from "@/lib/middleware/routeError";

interface RateLimitOptions {
  key: string;
  maxRequests?: number;
  windowMs?: number;
}

export function enforceRateLimit(
  req: Request,
  options: RateLimitOptions
): NextResponse | null {
  const maxRequests = options.maxRequests ?? 60;
  const windowMs = options.windowMs ?? 60_000;
  const ip = getClientIp(req);
  const bucketKey = `${options.key}:${ip}`;
  const result = consumeRateLimit(bucketKey, maxRequests, windowMs);
  if (result.ok) return null;

  const response = routeError(429, "Too many requests. Please retry shortly.");
  response.headers.set("retry-after", String(result.retryAfterSeconds));
  return response;
}

