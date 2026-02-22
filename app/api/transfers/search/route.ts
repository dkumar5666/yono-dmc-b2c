import { NextResponse } from "next/server";
import { searchTransfers } from "@/lib/backend/transfers";

interface TransferSearchBody {
  startLocationCode?: string;
  endAddressLine?: string;
  endCityName?: string;
  endCountryCode?: string;
  transferDateTime?: string;
  passengers?: number;
  currency?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TransferSearchBody;

    const startLocationCode = (body.startLocationCode ?? "").trim().toUpperCase();
    const endAddressLine = (body.endAddressLine ?? "").trim();
    const endCityName = (body.endCityName ?? "").trim();
    const endCountryCode = (body.endCountryCode ?? "").trim().toUpperCase();
    const transferDateTime = (body.transferDateTime ?? "").trim();

    if (!startLocationCode || startLocationCode.length !== 3) {
      return NextResponse.json({ error: "Valid startLocationCode (airport IATA) is required" }, { status: 400 });
    }
    if (!endAddressLine || !endCityName || !endCountryCode) {
      return NextResponse.json({ error: "endAddressLine, endCityName, endCountryCode are required" }, { status: 400 });
    }
    if (!transferDateTime) {
      return NextResponse.json({ error: "transferDateTime is required" }, { status: 400 });
    }

    const offers = await searchTransfers({
      startLocationCode,
      endAddressLine,
      endCityName,
      endCountryCode,
      transferDateTime,
      passengers: Math.max(1, Number(body.passengers ?? 2)),
      currency: (body.currency ?? "INR").toUpperCase(),
    });

    return NextResponse.json({ offers });
  } catch (error: unknown) {
    console.error("TRANSFER SEARCH ERROR:", error);
    return NextResponse.json({ error: "Failed to fetch transfer options" }, { status: 500 });
  }
}
