import { apiSuccess } from "@/lib/backend/http";
import { requireRole } from "@/lib/middleware/requireRole";

export async function GET(req: Request) {
  const auth = requireRole(req, "admin");
  if (auth.denied) return auth.denied;

  return apiSuccess(req, {
    report: "booking-lifecycle-summary",
    generatedAt: new Date().toISOString(),
    generatedBy: auth.userId,
  });
}
