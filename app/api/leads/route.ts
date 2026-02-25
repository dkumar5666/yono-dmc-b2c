import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";

interface CreateLeadBody {
  customerId?: string;
  destinationCountry?: string;
  destinationCity?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  paxAdults?: number;
  paxChildren?: number;
  source?: string;
  notes?: string;
}

export async function GET(req: Request) {
  try {
    const db = new SupabaseRestClient();
    const url = new URL(req.url);
    const query = new URLSearchParams();
    query.set("select", "*");
    query.set("order", "created_at.desc");

    const status = url.searchParams.get("status");
    if (status) query.set("status", `eq.${status}`);
    const customerId = url.searchParams.get("customerId");
    if (customerId) query.set("customer_id", `eq.${customerId}`);

    const leads = await db.selectMany<Record<string, unknown>>("leads", query);
    return apiSuccess(req, { leads });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "SUPABASE_NOT_CONFIGURED",
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    return apiError(req, 500, "LEADS_LIST_FAILED", "Failed to fetch leads.");
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as CreateLeadBody;
    if (!body.customerId) {
      return apiError(req, 400, "CUSTOMER_ID_REQUIRED", "customerId is required.");
    }

    const db = new SupabaseRestClient();
    const lead = await db.insertSingle<Record<string, unknown>>("leads", {
      id: randomUUID(),
      lead_code: `LEAD-${Date.now()}`,
      customer_id: body.customerId,
      destination_country: body.destinationCountry ?? null,
      destination_city: body.destinationCity ?? null,
      travel_start_date: body.travelStartDate ?? null,
      travel_end_date: body.travelEndDate ?? null,
      pax_adults: Math.max(1, Number(body.paxAdults ?? 1)),
      pax_children: Math.max(0, Number(body.paxChildren ?? 0)),
      source: body.source ?? "website",
      notes: body.notes ?? null,
      status: "lead_created",
      metadata: {},
    });

    return apiSuccess(req, { lead }, 201);
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "SUPABASE_NOT_CONFIGURED",
        "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY."
      );
    }
    return apiError(req, 500, "LEAD_CREATE_FAILED", "Failed to create lead.");
  }
}
