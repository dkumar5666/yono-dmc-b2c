import { amadeusGet } from "@/lib/backend/amadeusClient";

interface HotelByCityResponse {
  data?: Array<{ hotelId?: string }>;
}

interface HotelOffersResponse {
  data?: Array<{
    hotel?: {
      hotelId?: string;
      name?: string;
      cityCode?: string;
      address?: { lines?: string[]; cityName?: string; countryCode?: string };
      rating?: string;
      latitude?: number;
      longitude?: number;
    };
    offers?: Array<{
      id?: string;
      checkInDate?: string;
      checkOutDate?: string;
      room?: { typeEstimated?: { beds?: number; bedType?: string } };
      guests?: { adults?: number };
      price?: { total?: string; currency?: string };
      policies?: {
        cancellation?: { deadline?: string; description?: { text?: string } };
      };
    }>;
  }>;
}

export interface HotelSearchInput {
  cityCode: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  rooms?: number;
  currency?: string;
  max?: number;
}

export interface HotelOfferSummary {
  hotelId: string;
  name: string;
  cityCode: string;
  address: string;
  rating: string;
  latitude?: number;
  longitude?: number;
  offerId: string;
  checkInDate: string;
  checkOutDate: string;
  adults: number;
  beds?: number;
  bedType?: string;
  totalPrice: number;
  currency: string;
  cancellationDeadline?: string;
  cancellationText?: string;
  source: "amadeus";
  raw: unknown;
}

function toNumber(value: string | undefined): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

export async function searchHotels(input: HotelSearchInput): Promise<HotelOfferSummary[]> {
  const cityCode = input.cityCode.trim().toUpperCase();
  if (!cityCode) throw new Error("cityCode is required");

  const hotelsByCity = await amadeusGet<HotelByCityResponse>(
    "/v1/reference-data/locations/hotels/by-city",
    {
      cityCode,
    }
  );

  const hotelIds = (hotelsByCity.data ?? [])
    .map((item) => item.hotelId?.trim())
    .filter((item): item is string => Boolean(item))
    .slice(0, Math.min(input.max ?? 20, 50));

  if (hotelIds.length === 0) {
    return [];
  }

  const offersResponse = await amadeusGet<HotelOffersResponse>("/v3/shopping/hotel-offers", {
    hotelIds: hotelIds.join(","),
    adults: input.adults ?? 2,
    roomQuantity: input.rooms ?? 1,
    checkInDate: input.checkInDate,
    checkOutDate: input.checkOutDate,
    currency: input.currency ?? "INR",
    bestRateOnly: true,
  });

  const output: HotelOfferSummary[] = [];

  for (const item of offersResponse.data ?? []) {
    const offer = item.offers?.[0];
    if (!offer || !item.hotel) continue;

    const addressParts = [
      ...(item.hotel.address?.lines ?? []),
      item.hotel.address?.cityName,
      item.hotel.address?.countryCode,
    ].filter(Boolean);

    output.push({
      hotelId: item.hotel.hotelId ?? "",
      name: item.hotel.name ?? "Hotel",
      cityCode: item.hotel.cityCode ?? cityCode,
      address: addressParts.join(", "),
      rating: item.hotel.rating ?? "N/A",
      latitude: item.hotel.latitude,
      longitude: item.hotel.longitude,
      offerId: offer.id ?? "",
      checkInDate: offer.checkInDate ?? input.checkInDate,
      checkOutDate: offer.checkOutDate ?? input.checkOutDate,
      adults: offer.guests?.adults ?? input.adults ?? 2,
      beds: offer.room?.typeEstimated?.beds,
      bedType: offer.room?.typeEstimated?.bedType,
      totalPrice: toNumber(offer.price?.total),
      currency: offer.price?.currency ?? input.currency ?? "INR",
      cancellationDeadline: offer.policies?.cancellation?.deadline,
      cancellationText: offer.policies?.cancellation?.description?.text,
      source: "amadeus",
      raw: item,
    });
  }

  return output;
}
