import { NextResponse } from "next/server";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";
import { searchFlights } from "@/lib/backend/flights";
import { searchHotels } from "@/lib/backend/hotels";
import { searchActivities } from "@/lib/backend/activities";

interface ProductSearchBody {
  productType?: "flights" | "hotels" | "activities";
  payload?: Record<string, unknown>;
}

export async function POST(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:products-search",
    maxRequests: 90,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await req.json()) as ProductSearchBody;
    const productType = body.productType ?? "flights";
    const payload = body.payload ?? {};

    if (productType === "flights") {
      const offers = await searchFlights(
        payload as unknown as Parameters<typeof searchFlights>[0]
      );
      return NextResponse.json({ productType, offers });
    }

    if (productType === "hotels") {
      const offers = await searchHotels(
        payload as unknown as Parameters<typeof searchHotels>[0]
      );
      return NextResponse.json({ productType, offers });
    }

    if (productType === "activities") {
      const activities = await searchActivities(
        payload as unknown as Parameters<typeof searchActivities>[0]
      );
      return NextResponse.json({ productType, activities });
    }

    return NextResponse.json({ success: false, error: "Invalid productType" }, { status: 400 });
  } catch {
    return NextResponse.json({ success: false, error: "Failed to search products" }, { status: 500 });
  }
}
