import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import { validateEnv } from "@/lib/config/validateEnv";

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  const result = validateEnv();
  return NextResponse.json(result);
}

