import { apiSuccess } from "@/lib/backend/http";
import {
  generateInvoicePdf,
  generateItineraryPdf,
  generateVoucherPdf,
} from "@/lib/services/document.service";
import { DocumentType } from "@/types/tos";
import { requireRole } from "@/lib/middleware/requireRole";
import { verifyBookingOwnership } from "@/lib/middleware/verifyBookingOwnership";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";

interface GenerateDocumentBody {
  bookingId?: string;
  customerId?: string;
  generatedBy?: string;
  type?: DocumentType;
  payload?: Record<string, unknown>;
}

function isDocumentType(value: string): value is DocumentType {
  return [
    "invoice",
    "voucher",
    "itinerary",
    "ticket",
    "visa",
    "insurance",
    "other",
  ].includes(value);
}

export async function POST(req: Request) {
  const auth = requireRole(req, ["customer", "agent", "admin"]);
  if (auth.denied) return auth.denied;

  try {
    const body = (await req.json()) as GenerateDocumentBody;
    const bookingId = (body.bookingId ?? "").trim();
    if (!bookingId) {
      return NextResponse.json({ success: false, error: "bookingId is required." }, { status: 400 });
    }
    const ownershipError = await verifyBookingOwnership({
      bookingId,
      role: auth.role,
      userId: auth.userId,
      allowSupplier: false,
    });
    if (ownershipError) return ownershipError;

    const type = body.type ?? "invoice";
    if (!isDocumentType(type)) {
      return NextResponse.json({ success: false, error: "Invalid document type." }, { status: 400 });
    }

    const base = {
      bookingId,
      customerId: auth.role === "admin" ? body.customerId ?? null : null,
      generatedBy: body.generatedBy ?? auth.userId ?? null,
      payload: body.payload ?? {},
    };

    const document =
      type === "invoice"
        ? await generateInvoicePdf(base)
        : type === "voucher"
          ? await generateVoucherPdf(base)
          : await generateItineraryPdf(base);

    return apiSuccess(req, { document }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message.includes("Supabase is not configured")) {
      return routeError(500, "Supabase is not configured.");
    }
    return routeError(500, "Failed to generate document");
  }
}

