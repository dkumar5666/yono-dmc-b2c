import { NextResponse } from "next/server";
import { getCatalog, saveCatalog } from "@/lib/backend/catalogStore";
import { requireRole } from "@/lib/middleware/requireRole";
import { Destination, Package } from "@/data/mockData";

interface CatalogBody {
  packages?: Partial<Package>[];
  destinations?: Partial<Destination>[];
}

export async function GET(req: Request) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error: unknown) {
    console.error("CATALOG GET ERROR:", error);
    return NextResponse.json({ success: false, error: "Failed to load catalog" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authError = requireRole(req, "admin").denied;
    if (authError) return authError;

    const body = (await req.json()) as CatalogBody;
    if (!Array.isArray(body.packages) || !Array.isArray(body.destinations)) {
      return NextResponse.json(
        { success: false, error: "packages and destinations arrays are required" },
        { status: 400 }
      );
    }

    const saved = await saveCatalog({
      packages: body.packages,
      destinations: body.destinations,
    });
    return NextResponse.json(saved);
  } catch (error: unknown) {
    console.error("CATALOG PUT ERROR:", error);
    return NextResponse.json({ success: false, error: "Failed to save catalog" }, { status: 500 });
  }
}
