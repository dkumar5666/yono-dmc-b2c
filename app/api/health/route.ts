import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";

export async function GET(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:health",
    maxRequests: 240,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  return NextResponse.json({
    success: true,
    status: "ok",
    timestamp: new Date().toISOString(),
  });
}

