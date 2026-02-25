import { NextResponse } from "next/server";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  listCustomPackageRequests,
  CustomPackageStatus,
} from "@/lib/backend/customPackageRequests";

export async function GET(req: Request) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") ?? "all") as CustomPackageStatus | "all";

    if (!["all", "new", "in_progress", "quoted", "closed"].includes(status)) {
      return NextResponse.json({ success: false, error: "Invalid status filter" }, { status: 400 });
    }

    const requests = listCustomPackageRequests(status);
    return NextResponse.json({ requests });
  } catch (error: unknown) {
    console.error("ADMIN CUSTOM PACKAGE LIST ERROR:", error);
    return NextResponse.json({ success: false, error: "Failed to load requests" }, { status: 500 });
  }
}

