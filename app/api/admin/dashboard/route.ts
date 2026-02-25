import { apiSuccess } from "@/lib/backend/http";
import { requireRole } from "@/lib/middleware/requireRole";
import { SupabaseNotConfiguredError, SupabaseRestClient } from "@/lib/core/supabase-rest";
import { routeError } from "@/lib/middleware/routeError";

async function countByTable(db: SupabaseRestClient, table: string): Promise<number> {
  const query = new URLSearchParams();
  query.set("select", "id");
  const rows = await db.selectMany<{ id: string }>(table, query);
  return rows.length;
}

export async function GET(req: Request) {
  const denied = requireRole(req, "admin").denied;
  if (denied) return denied;

  try {
    const db = new SupabaseRestClient();
    const [bookings, leads, quotations, suppliers, customers] = await Promise.all([
      countByTable(db, "bookings"),
      countByTable(db, "leads"),
      countByTable(db, "quotations"),
      countByTable(db, "suppliers"),
      countByTable(db, "customers"),
    ]);

    return apiSuccess(req, {
      overview: { bookings, leads, quotations, suppliers, customers },
    });
  } catch (error) {
    if (error instanceof SupabaseNotConfiguredError) {
      return routeError(500, "Supabase is not configured.");
    }
    return routeError(500, "Failed to load dashboard metrics.");
  }
}
