import { NextResponse } from "next/server";
import { getCatalog, saveCatalog } from "@/lib/backend/catalogStore";
import { requireRoles } from "@/lib/backend/adminAuth";
import { Destination, Package } from "@/data/mockData";

interface CatalogBody {
  packages?: Partial<Package>[];
  destinations?: Partial<Destination>[];
}

export async function GET() {
  try {
    const catalog = await getCatalog();
    return NextResponse.json(catalog);
  } catch (error: unknown) {
    console.error("CATALOG GET ERROR:", error);
    return NextResponse.json({ error: "Failed to load catalog" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const authError = requireRoles(req, ["admin", "editor"]);
    if (authError) return authError;

    const body = (await req.json()) as CatalogBody;
    if (!Array.isArray(body.packages) || !Array.isArray(body.destinations)) {
      return NextResponse.json(
        { error: "packages and destinations arrays are required" },
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
    return NextResponse.json({ error: "Failed to save catalog" }, { status: 500 });
  }
}
