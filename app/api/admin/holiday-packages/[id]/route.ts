import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  deleteHolidayPackage,
  getHolidayPackage,
  updateHolidayPackage,
  type HolidayPackageInput,
} from "@/lib/backend/travelAdmin";

interface RouteContext {
  params: Promise<{ id: string }> | { id: string };
}

export async function GET(req: Request, context: RouteContext) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    return NextResponse.json({ data: getHolidayPackage(params.id) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to load package";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PUT(req: Request, context: RouteContext) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const body = (await req.json()) as HolidayPackageInput;
    return NextResponse.json({ data: updateHolidayPackage(params.id, body) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update package";
    const status =
      message.includes("required") || message.includes("must")
        ? 400
        : message.includes("not found")
          ? 404
          : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function DELETE(req: Request, context: RouteContext) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    deleteHolidayPackage(params.id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete package";
    const status = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

