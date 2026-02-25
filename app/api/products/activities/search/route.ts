import { NextResponse } from "next/server";
import { searchActivities } from "@/lib/backend/activities";
import { getTicketedAttractionsByDestination } from "@/data/ticketedAttractions";
import { enforceRateLimit } from "@/lib/middleware/rateLimit";

interface ActivitiesSearchBody {
  destination?: string;
  radius?: number;
}

export async function POST(req: Request) {
  const rateLimitResponse = enforceRateLimit(req, {
    key: "public:products-activities-search",
    maxRequests: 80,
    windowMs: 60_000,
  });
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = (await req.json()) as ActivitiesSearchBody;
    const destination = (body.destination ?? "").trim();

    if (!destination) {
      return NextResponse.json({ error: "destination is required" }, { status: 400 });
    }

    try {
      const activities = await searchActivities({
        destination,
        radius: Math.min(Math.max(1, Number(body.radius ?? 20)), 100),
      });
      return NextResponse.json({ activities });
    } catch {
      const fallback = getTicketedAttractionsByDestination(destination);
      const activities = (fallback?.items ?? []).slice(0, 40).map((item) => ({
        id: item.id,
        name: item.title,
        description: item.description,
        image: item.image,
        bookingLink: item.ticketsHref,
        amount: 0,
        currency: "INR",
        source: "fallback",
        raw: null,
      }));
      return NextResponse.json({ activities });
    }
  } catch {
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
