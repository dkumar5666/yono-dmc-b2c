import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  getSupplierSignupRequestById,
  logSupplierSignupSystemEvent,
  updateSupplierSignupRequest,
} from "@/lib/supplierSignup/store";
import { validateSupplierSignupRequestPayload } from "@/lib/supplierSignup/validators";

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

export async function POST(req: Request) {
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_details",
    maxRequests: 20,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many detail update attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const requestId = safeString(body.request_id);
    if (!requestId) {
      return apiError(req, 400, "request_id_required", "request_id is required.");
    }

    const db = new SupabaseRestClient();
    const signupRequest = await getSupplierSignupRequestById(db, requestId);
    if (!signupRequest) {
      return apiError(req, 404, "request_not_found", "Supplier signup request not found.");
    }

    const status = safeString(signupRequest.status);
    if (status === "approved") {
      return apiError(req, 400, "already_approved", "Request is already approved.");
    }
    if (status === "rejected") {
      return apiError(req, 400, "already_rejected", "Request is already rejected.");
    }

    if (!signupRequest.email_verified || !signupRequest.phone_verified) {
      return apiError(
        req,
        400,
        "verification_pending",
        "Complete email and mobile OTP verification before entering business details."
      );
    }

    const mergedPayload: Record<string, unknown> = {
      ...body,
      contact_email: safeString(signupRequest.contact_email),
      contact_phone: safeString(signupRequest.contact_phone),
    };
    const validation = validateSupplierSignupRequestPayload(mergedPayload);
    if (!validation.ok || !validation.data) {
      return apiError(
        req,
        400,
        "validation_failed",
        validation.errors[0] || "Invalid supplier details.",
        { errors: validation.errors }
      );
    }

    const existingMeta = safeObject(signupRequest.meta);
    const nextMeta = {
      ...existingMeta,
      details_saved_at: new Date().toISOString(),
    };

    await updateSupplierSignupRequest(db, requestId, {
      business_type: validation.data.business_type,
      company_legal_name: validation.data.company_legal_name,
      brand_name: validation.data.brand_name || null,
      address: validation.data.address,
      city: validation.data.city,
      pin_code: validation.data.pin_code,
      country: validation.data.country || "India",
      website: validation.data.website || null,
      contact_name: validation.data.contact_name,
      alt_phone: validation.data.alt_phone || null,
      support_email: validation.data.support_email || null,
      gstin: validation.data.gstin,
      pan: validation.data.pan,
      cin: validation.data.cin || null,
      iata_code: validation.data.iata_code || null,
      license_no: validation.data.license_no || null,
      bank_meta: validation.data.bank_meta || {},
      meta: nextMeta,
    });

    await logSupplierSignupSystemEvent(db, {
      requestId,
      event: "supplier_signup_details_saved",
      message: "Supplier signup business details saved.",
      meta: {
        business_type: validation.data.business_type,
        company_legal_name: validation.data.company_legal_name,
      },
    });

    return apiSuccess(req, {
      request_id: requestId,
      details_saved: true,
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(req, 500, "details_save_failed", "Failed to save supplier details.");
  }
}

