import { apiSuccess } from "@/lib/backend/http";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  aiConversationStatuses,
  exportAIConversationsCsv,
  listAIConversations,
} from "@/lib/backend/aiConversations";
import { NextResponse } from "next/server";
import { routeError } from "@/lib/middleware/routeError";

export async function GET(req: Request) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const url = new URL(req.url);
    const status = url.searchParams.get("status") ?? "all";
    const format = url.searchParams.get("format") ?? "json";

    if (
      status !== "all" &&
      !aiConversationStatuses.includes(status as (typeof aiConversationStatuses)[number])
    ) {
      return NextResponse.json({ success: false, error: "Invalid status filter." }, { status: 400 });
    }

    if (format === "csv") {
      const csv = exportAIConversationsCsv(status);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename=\"ai-conversations-${new Date()
            .toISOString()
            .slice(0, 10)}.csv\"`,
        },
      });
    }

    const conversations = listAIConversations().filter((item) =>
      status !== "all" ? item.status === status : true
    );
    return apiSuccess(req, { conversations });
  } catch {
    return routeError(500, "Failed to load AI conversations.");
  }
}
