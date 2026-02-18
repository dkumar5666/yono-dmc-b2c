import {
  BookingPayload,
  BookingType,
  FlightSearchRequest,
  Traveler,
} from "@/lib/backend/types";

function isIataCode(value: string): boolean {
  return /^[A-Z]{3}$/.test(value);
}

function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function validateFlightSearchRequest(
  input: FlightSearchRequest
): string | null {
  if (!isIataCode(input.from.toUpperCase())) {
    return "Invalid 'from' IATA code";
  }
  if (!isIataCode(input.to.toUpperCase())) {
    return "Invalid 'to' IATA code";
  }
  if (!isDate(input.date)) {
    return "Invalid 'date' format. Use YYYY-MM-DD";
  }
  if (input.returnDate && !isDate(input.returnDate)) {
    return "Invalid 'returnDate' format. Use YYYY-MM-DD";
  }
  return null;
}

function isValidBookingType(type: string): type is BookingType {
  return type === "flight";
}

function isTraveler(value: Traveler): boolean {
  return Boolean(value.firstName?.trim() && value.lastName?.trim());
}

export function validateBookingPayload(
  payload: BookingPayload
): string | null {
  if (!isValidBookingType(payload.type)) return "Invalid booking type";
  if (!payload.offerId?.trim()) return "offerId is required";
  if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
    return "amount must be a positive number";
  }
  if (!payload.currency?.trim()) return "currency is required";
  if (!payload.contact?.name?.trim()) return "contact.name is required";
  if (!payload.contact?.email?.trim()) return "contact.email is required";
  if (!payload.contact?.phone?.trim()) return "contact.phone is required";
  if (!Array.isArray(payload.travelers) || payload.travelers.length === 0) {
    return "At least one traveler is required";
  }
  if (payload.travelers.some((traveler) => !isTraveler(traveler))) {
    return "Each traveler must include firstName and lastName";
  }
  return null;
}
