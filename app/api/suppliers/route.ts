import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { getSupplierIdByUserId } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";

interface CreateSupplierBody {
  supplierType?: string;
  legalName?: string;
  tradeName?: string;
  contactEmail?: string;
  contactPhone?: string;
  defaultCurrency?: string;
  apiEnabled?: boolean;
  apiProvider?: string;
}

export async function GET(req: Request) {
  const auth = requireRole(req, ["supplier", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const db = new SupabaseRestClient();
    const query = new URLSearchParams();
    query.set("select", "*");
    query.set("order", "created_at.desc");

    if (auth.role === "supplier") {
      if (!auth.userId) return routeError(401, "Not authenticated");
      const supplierId = await getSupplierIdByUserId(auth.userId);
      if (!supplierId) return routeError(403, "Not authorized");
      query.set("id", `eq.${supplierId}`);
    }

    const suppliers = await db.selectMany<Record<string, unknown>>("suppliers", query);
    return apiSuccess(req, { suppliers });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "SUPABASE_NOT_CONFIGURED",
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    return apiError(req, 500, "SUPPLIERS_LIST_FAILED", "Failed to fetch suppliers.");
  }
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["supplier", "admin"]);
  if (auth.denied) return auth.denied;
  if (auth.role !== "admin") return routeError(403, "Not authorized");

  try {
    const body = (await req.json()) as CreateSupplierBody;
    if (!body.legalName || !body.supplierType) {
      return NextResponse.json(
        { success: false, error: "legalName and supplierType are required." },
        { status: 400 }
      );
    }

    const db = new SupabaseRestClient();
    const supplier = await db.insertSingle<Record<string, unknown>>("suppliers", {
      id: randomUUID(),
      supplier_code: `SUP-${Date.now()}`,
      supplier_type: body.supplierType,
      legal_name: body.legalName,
      trade_name: body.tradeName ?? null,
      contact_email: body.contactEmail ?? null,
      contact_phone: body.contactPhone ?? null,
      default_currency: (body.defaultCurrency ?? "USD").toUpperCase(),
      api_enabled: Boolean(body.apiEnabled),
      api_provider: body.apiProvider ?? null,
      status: "active",
      metadata: {},
    });

    return apiSuccess(req, { supplier }, 201);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(500, "Supabase is not configured.");
    }
    return routeError(500, "Failed to create supplier");
  }
}
