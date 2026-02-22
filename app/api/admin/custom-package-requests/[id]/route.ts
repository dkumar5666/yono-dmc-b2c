import { NextResponse } from "next/server";
import { requireRoles } from "@/lib/backend/adminAuth";
import {
  CustomPackageStatus,
  getCustomPackageRequestById,
  updateCustomPackageRequestStatus,
} from "@/lib/backend/customPackageRequests";

interface PatchBody {
  status?: CustomPackageStatus;
  admin_notes?: string;
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  const authError = requireRoles(req, ["admin", "editor"]);
  if (authError) return authError;

  try {
    const params = "then" in context.params ? await context.params : context.params;
    const existing = getCustomPackageRequestById(params.id);
    if (!existing) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    const body = (await req.json()) as PatchBody;
    const status = body.status;
    if (!status || !["new", "in_progress", "quoted", "closed"].includes(status)) {
      return NextResponse.json({ error: "Valid status is required" }, { status: 400 });
    }

    const updated = updateCustomPackageRequestStatus(params.id, status, body.admin_notes ?? "");
    return NextResponse.json({ request: updated });
  } catch (error: unknown) {
    console.error("ADMIN CUSTOM PACKAGE PATCH ERROR:", error);
    return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
  }
}
