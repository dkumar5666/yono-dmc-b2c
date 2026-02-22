import { amadeusGet } from "@/lib/backend/amadeusClient";

interface LocationResponse {
  data?: Array<{
    name?: string;
    iataCode?: string;
    geoCode?: { latitude?: number; longitude?: number };
  }>;
}

interface ActivitiesResponse {
  data?: Array<{
    id?: string;
    name?: string;
    shortDescription?: string;
    description?: string;
    pictures?: string[];
    bookingLink?: string;
    price?: { amount?: string; currencyCode?: string };
    geoCode?: { latitude?: number; longitude?: number };
  }>;
}

export interface ActivitySearchInput {
  destination: string;
  radius?: number;
}

export interface ActivitySummary {
  id: string;
  name: string;
  description: string;
  image: string | null;
  bookingLink: string | null;
  amount: number;
  currency: string;
  latitude?: number;
  longitude?: number;
  source: "amadeus";
  raw: unknown;
}

function toNumber(value: string | undefined): number {
  const n = Number(value ?? "0");
  return Number.isFinite(n) ? n : 0;
}

async function resolveCoordinates(destination: string): Promise<{ latitude: number; longitude: number } | null> {
  const location = await amadeusGet<LocationResponse>("/v1/reference-data/locations", {
    subType: "CITY",
    keyword: destination,
    pageLimit: 1,
  });

  const first = location.data?.[0];
  const lat = first?.geoCode?.latitude;
  const lng = first?.geoCode?.longitude;
  if (typeof lat !== "number" || typeof lng !== "number") return null;
  return { latitude: lat, longitude: lng };
}

export async function searchActivities(input: ActivitySearchInput): Promise<ActivitySummary[]> {
  const destination = input.destination.trim();
  if (!destination) throw new Error("destination is required");

  const coordinates = await resolveCoordinates(destination);
  if (!coordinates) return [];

  const response = await amadeusGet<ActivitiesResponse>("/v1/shopping/activities", {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    radius: input.radius ?? 20,
  });

  return (response.data ?? []).map((item, index) => ({
    id: item.id ?? `activity-${index + 1}`,
    name: item.name ?? "Activity",
    description: item.shortDescription ?? item.description ?? "",
    image: item.pictures?.[0] ?? null,
    bookingLink: item.bookingLink ?? null,
    amount: toNumber(item.price?.amount),
    currency: item.price?.currencyCode ?? "EUR",
    latitude: item.geoCode?.latitude,
    longitude: item.geoCode?.longitude,
    source: "amadeus",
    raw: item,
  }));
}
