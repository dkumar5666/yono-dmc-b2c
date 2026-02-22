import { amadeusGet } from "@/lib/backend/amadeusClient";

interface TransferOfferResponse {
  data?: Array<{
    id?: string;
    transferType?: string;
    quotation?: {
      monetaryAmount?: string;
      currencyCode?: string;
    };
    vehicle?: {
      code?: string;
      description?: string;
      seats?: number;
      baggage?: { quantity?: number };
    };
    start?: { dateTime?: string };
  }>;
}

export interface TransferSearchInput {
  startLocationCode: string;
  endAddressLine: string;
  endCityName: string;
  endCountryCode: string;
  transferDateTime: string;
  passengers?: number;
  currency?: string;
}

export interface TransferOfferSummary {
  id: string;
  transferType: string;
  vehicle: string;
  seats: number;
  baggage: number;
  amount: number;
  currency: string;
  pickupTime?: string;
  source: "amadeus" | "fallback";
  raw: unknown;
}

function toNumber(value: string | undefined): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

function buildFallbackOffers(input: TransferSearchInput): TransferOfferSummary[] {
  const pax = Math.max(1, input.passengers ?? 2);
  const base = 1200 + pax * 250;
  return [
    {
      id: "fallback-sedan",
      transferType: "PRIVATE",
      vehicle: "Sedan",
      seats: 3,
      baggage: 2,
      amount: base,
      currency: input.currency ?? "INR",
      pickupTime: input.transferDateTime,
      source: "fallback",
      raw: null,
    },
    {
      id: "fallback-suv",
      transferType: "PRIVATE",
      vehicle: "SUV",
      seats: 5,
      baggage: 4,
      amount: base + 900,
      currency: input.currency ?? "INR",
      pickupTime: input.transferDateTime,
      source: "fallback",
      raw: null,
    },
    {
      id: "fallback-van",
      transferType: "PRIVATE",
      vehicle: "Van",
      seats: 8,
      baggage: 7,
      amount: base + 1800,
      currency: input.currency ?? "INR",
      pickupTime: input.transferDateTime,
      source: "fallback",
      raw: null,
    },
  ];
}

export async function searchTransfers(input: TransferSearchInput): Promise<TransferOfferSummary[]> {
  try {
    const response = await amadeusGet<TransferOfferResponse>("/v1/shopping/transfer-offers", {
      startLocationCode: input.startLocationCode,
      endAddressLine: input.endAddressLine,
      endCityName: input.endCityName,
      endCountryCode: input.endCountryCode,
      transferType: "PRIVATE",
      startDateTime: input.transferDateTime,
      passengers: input.passengers ?? 2,
      currencyCode: input.currency ?? "INR",
    });

    const offers = (response.data ?? []).map((item, index) => ({
      id: item.id ?? `transfer-${index + 1}`,
      transferType: item.transferType ?? "PRIVATE",
      vehicle: item.vehicle?.description ?? item.vehicle?.code ?? "Transfer",
      seats: item.vehicle?.seats ?? 0,
      baggage: item.vehicle?.baggage?.quantity ?? 0,
      amount: toNumber(item.quotation?.monetaryAmount),
      currency: item.quotation?.currencyCode ?? input.currency ?? "INR",
      pickupTime: item.start?.dateTime,
      source: "amadeus" as const,
      raw: item,
    }));

    if (offers.length > 0) return offers;
    return buildFallbackOffers(input);
  } catch {
    return buildFallbackOffers(input);
  }
}
