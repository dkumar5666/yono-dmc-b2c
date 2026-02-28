import { randomUUID } from "node:crypto";
import { apiError, apiSuccess } from "@/lib/backend/http";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { checkSupplierSignupRateLimit } from "@/lib/supplierSignup/rateLimit";
import {
  logSupplierSignupSystemEvent,
  safeInsert,
  safeSelectMany,
  type SupplierSignupRequestRow,
} from "@/lib/supplierSignup/store";
import {
  isValidE164Phone,
  isValidEmail,
  normalizeEmail,
  normalizePhone,
} from "@/lib/supplierSignup/validators";

const DEDUPE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

interface StartBody {
  contact_email?: string;
  contact_phone?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeRowId(row: SupplierSignupRequestRow | null): string {
  return safeString(row?.id);
}

async function findExistingRequest(
  db: SupabaseRestClient,
  params: { contactEmail: string; contactPhone: string; sinceIso: string }
): Promise<SupplierSignupRequestRow | null> {
  const seen = new Map<string, SupplierSignupRequestRow>();

  if (params.contactEmail) {
    const rows = await safeSelectMany<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        contact_email: `eq.${params.contactEmail}`,
        created_at: `gte.${params.sinceIso}`,
        order: "created_at.desc",
        limit: "5",
      })
    );
    for (const row of rows) {
      const id = normalizeRowId(row);
      if (id) seen.set(id, row);
    }
  }

  if (params.contactPhone) {
    const rows = await safeSelectMany<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      new URLSearchParams({
        select: "*",
        contact_phone: `eq.${params.contactPhone}`,
        created_at: `gte.${params.sinceIso}`,
        order: "created_at.desc",
        limit: "5",
      })
    );
    for (const row of rows) {
      const id = normalizeRowId(row);
      if (id) seen.set(id, row);
    }
  }

  const candidates = Array.from(seen.values());
  candidates.sort((a, b) => {
    const left = new Date(safeString(a.created_at) || 0).getTime() || 0;
    const right = new Date(safeString(b.created_at) || 0).getTime() || 0;
    return right - left;
  });
  return candidates[0] ?? null;
}

export async function POST(req: Request) {
  const rate = checkSupplierSignupRateLimit(req, {
    namespace: "supplier_signup_start",
    maxRequests: 12,
    windowMs: 60 * 60 * 1000,
  });

  if (rate.limited) {
    return apiError(
      req,
      429,
      "rate_limited",
      "Too many signup attempts. Please retry later.",
      { retryAfterSeconds: rate.retryAfterSeconds }
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as StartBody;
    const contactEmail = normalizeEmail(body.contact_email);
    const contactPhone = normalizePhone(body.contact_phone);

    if (!contactEmail) {
      return apiError(req, 400, "email_required", "Primary contact email is required.");
    }
    if (!isValidEmail(contactEmail)) {
      return apiError(req, 400, "invalid_email", "Primary contact email is invalid.");
    }
    if (!contactPhone) {
      return apiError(req, 400, "phone_required", "Primary contact mobile is required.");
    }
    if (!isValidE164Phone(contactPhone)) {
      return apiError(
        req,
        400,
        "invalid_phone",
        "Primary contact mobile must be in international format, e.g. +9199XXXXXXXX."
      );
    }

    const db = new SupabaseRestClient();
    const sinceIso = new Date(Date.now() - DEDUPE_WINDOW_MS).toISOString();
    const existing = await findExistingRequest(db, {
      contactEmail,
      contactPhone,
      sinceIso,
    });

    if (existing) {
      const existingId = normalizeRowId(existing);
      if (existingId) {
        await logSupplierSignupSystemEvent(db, {
          requestId: existingId,
          event: "supplier_signup_start_deduped",
          message: "Supplier signup step-1 request deduped.",
          meta: { deduped: true },
        });
        return apiSuccess(req, {
          request_id: existingId,
          deduped: true,
          email_verified: Boolean(existing.email_verified),
          phone_verified: Boolean(existing.phone_verified),
        });
      }
    }

    const nowIso = new Date().toISOString();
    const rowId = randomUUID();
    const payload: Record<string, unknown> = {
      id: rowId,
      status: "pending",
      contact_email: contactEmail,
      contact_phone: contactPhone,
      email_verified: false,
      phone_verified: false,
      docs: {},
      meta: {
        source_ip: rate.ip,
        user_agent: req.headers.get("user-agent") || null,
      },
      created_at: nowIso,
      updated_at: nowIso,
    };

    const inserted = await safeInsert<SupplierSignupRequestRow>(
      db,
      "supplier_signup_requests",
      payload
    );
    if (!inserted) {
      const fallbackExisting = await findExistingRequest(db, {
        contactEmail,
        contactPhone,
        sinceIso: "1970-01-01T00:00:00.000Z",
      });
      const fallbackId = normalizeRowId(fallbackExisting);
      if (fallbackId) {
        return apiSuccess(req, {
          request_id: fallbackId,
          deduped: true,
          email_verified: Boolean(fallbackExisting?.email_verified),
          phone_verified: Boolean(fallbackExisting?.phone_verified),
        });
      }
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }

    const insertedId = normalizeRowId(inserted) || rowId;
    await logSupplierSignupSystemEvent(db, {
      requestId: insertedId,
      event: "supplier_signup_step1_created",
      message: "Supplier signup step-1 request created.",
      meta: { contact_email: contactEmail },
    });

    return apiSuccess(
      req,
      {
        request_id: insertedId,
        deduped: false,
        email_verified: false,
        phone_verified: false,
      },
      201
    );
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return apiError(
        req,
        503,
        "supplier_signup_unavailable",
        "Supplier signup requests are unavailable right now."
      );
    }
    return apiError(req, 500, "supplier_signup_start_failed", "Failed to start supplier signup.");
  }
}

