import { bookingEventDispatcher } from "@/lib/core/event-dispatcher";
import {
  generateInvoicePdf,
  generateItineraryPdf,
  generateVoucherPdf,
} from "@/lib/services/document.service";
import { logError, logInfo } from "@/lib/backend/logger";

let initialized = false;

export function ensureBookingAutomationHandlers(): void {
  if (initialized) return;
  initialized = true;

  bookingEventDispatcher.on("booking.payment_confirmed", async (payload) => {
    try {
      const invoice = await generateInvoicePdf({
        bookingId: payload.booking.id,
        customerId: payload.booking.customer_id,
        generatedBy: payload.lifecycleEvent.actor_id,
        payload: {
          bookingCode: payload.booking.booking_code,
          amount: payload.booking.gross_amount,
          currency: payload.booking.currency_code,
        },
      });

      logInfo("Invoice generated after payment confirmation", {
        bookingId: payload.booking.id,
        documentId: invoice.id,
      });
    } catch (error) {
      logError("Failed to generate invoice after payment confirmation", {
        bookingId: payload.booking.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  bookingEventDispatcher.on("booking.supplier_confirmed", async (payload) => {
    try {
      const voucher = await generateVoucherPdf({
        bookingId: payload.booking.id,
        customerId: payload.booking.customer_id,
        generatedBy: payload.lifecycleEvent.actor_id,
        payload: {
          bookingCode: payload.booking.booking_code,
          supplierReference: payload.booking.supplier_confirmation_reference,
        },
      });
      const itinerary = await generateItineraryPdf({
        bookingId: payload.booking.id,
        customerId: payload.booking.customer_id,
        generatedBy: payload.lifecycleEvent.actor_id,
        payload: {
          bookingCode: payload.booking.booking_code,
          travelStartDate: payload.booking.travel_start_date,
          travelEndDate: payload.booking.travel_end_date,
        },
      });

      logInfo("Voucher and itinerary generated after supplier confirmation", {
        bookingId: payload.booking.id,
        voucherId: voucher.id,
        itineraryId: itinerary.id,
      });
    } catch (error) {
      logError("Failed to generate supplier confirmation documents", {
        bookingId: payload.booking.id,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  });

  bookingEventDispatcher.on("booking.completed", async (payload) => {
    logInfo("Booking completed, customer communication event emitted", {
      bookingId: payload.booking.id,
      customerId: payload.booking.customer_id,
      event: "send_completion_email",
    });
  });
}
