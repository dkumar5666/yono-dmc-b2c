import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import {
  listCustomPackageRequests,
  CustomPackageStatus,
} from "@/lib/backend/customPackageRequests";

export async function GET(req: Request) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const { searchParams } = new URL(req.url);
    const status = (searchParams.get("status") ?? "all") as CustomPackageStatus | "all";

    if (!["all", "new", "in_progress", "quoted", "closed"].includes(status)) {
      return NextResponse.json({ error: "Invalid status filter" }, { status: 400 });
    }

    const requests = listCustomPackageRequests(status);
    return NextResponse.json({ requests });
  } catch (error: unknown) {
    console.error("ADMIN CUSTOM PACKAGE LIST ERROR:", error);
    return NextResponse.json({ error: "Failed to load requests" }, { status: 500 });
  }
}
