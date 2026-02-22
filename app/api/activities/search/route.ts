import { NextResponse } from "next/server";
import { searchActivities } from "@/lib/backend/activities";

interface ActivitiesSearchBody {
  destination?: string;
  radius?: number;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ActivitiesSearchBody;
    const destination = (body.destination ?? "").trim();

    if (!destination) {
      return NextResponse.json({ error: "destination is required" }, { status: 400 });
    }

    const activities = await searchActivities({
      destination,
      radius: Math.min(Math.max(1, Number(body.radius ?? 20)), 100),
    });

    return NextResponse.json({ activities });
  } catch (error: unknown) {
    console.error("ACTIVITIES SEARCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch activities" }, { status: 500 });
  }
}
