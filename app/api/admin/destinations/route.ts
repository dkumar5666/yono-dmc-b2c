import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  createDestination,
  getDestinationMeta,
  listDestinations,
  type DestinationInput,
} from "@/lib/backend/travelAdmin";

export async function GET(req: Request) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    return NextResponse.json({
      data: listDestinations(),
      meta: getDestinationMeta(),
    });
  } catch (error: unknown) {
    console.error("DESTINATIONS GET ERROR:", error);
    return NextResponse.json({ success: false, error: "Failed to load destinations" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const body = (await req.json()) as DestinationInput;
    const created = createDestination(body);
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to create destination";
    const status = message.includes("required") || message.includes("must") ? 400 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

