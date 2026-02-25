import { NextResponse } from "next/server";
import { searchHotels } from "@/lib/backend/hotels";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";

interface HotelSearchBody {
  cityCode?: string;
  checkInDate?: string;
  checkOutDate?: string;
  adults?: number;
  rooms?: number;
  currency?: string;
  max?: number;
}

export async function POST(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:products-hotels-search",
    maxRequests: 80,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await req.json()) as HotelSearchBody;
    const cityCode = (body.cityCode ?? "").trim().toUpperCase();
    const checkInDate = (body.checkInDate ?? "").trim();
    const checkOutDate = (body.checkOutDate ?? "").trim();
    if (!cityCode || cityCode.length !== 3) {
      return NextResponse.json({ error: "Valid cityCode (IATA 3-letter) is required" }, { status: 400 });
    }
    if (!checkInDate || !checkOutDate) {
      return NextResponse.json({ error: "checkInDate and checkOutDate are required" }, { status: 400 });
    }

    const offers = await searchHotels({
      cityCode,
      checkInDate,
      checkOutDate,
      adults: Math.max(1, Number(body.adults ?? 2)),
      rooms: Math.max(1, Number(body.rooms ?? 1)),
      currency: (body.currency ?? "INR").toUpperCase(),
      max: Math.min(Math.max(1, Number(body.max ?? 20)), 50),
    });

    return NextResponse.json({ offers });
  } catch {
    return NextResponse.json({ error: "Failed to fetch hotels" }, { status: 500 });
  }
}
