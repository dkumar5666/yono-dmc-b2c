import { apiSuccess } from "@/lib/backend/http";
import { requireRole } from "@/lib/middleware/requireRole";
import {
  AIConversationStatus,
  aiConversationStatuses,
  getAIConversationById,
  updateAIConversation,
} from "@/lib/backend/aiConversations";
import { routeError } from "@/lib/middleware/routeError";
import { NextResponse } from "next/server";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: Request, ctx: RouteParams) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    const conversation = getAIConversationById(id);
    if (!conversation) {
      return routeError(404, "Conversation not found");
    }
    return apiSuccess(req, { conversation });
  } catch {
    return routeError(500, "Failed to load conversation");
  }
}

export async function PATCH(req: Request, ctx: RouteParams) {
  const authError = requireRole(req, "admin").denied;
  if (authError) return authError;

  try {
    const { id } = await ctx.params;
    const body = (await req.json()) as {
      status?: string;
      admin_notes?: string;
      assigned_to?: string;
    };

    if (
      body.status &&
      !aiConversationStatuses.includes(body.status as AIConversationStatus)
    ) {
      return NextResponse.json({ success: false, error: "Invalid status value." }, { status: 400 });
    }

    const updated = updateAIConversation(id, {
      status: body.status as AIConversationStatus | undefined,
      admin_notes: body.admin_notes,
      assigned_to: body.assigned_to,
    });
    if (!updated) {
      return routeError(404, "Conversation not found");
    }
    return apiSuccess(req, { conversation: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update conversation.";
    if (message === "Conversation not found") {
      return routeError(404, "Conversation not found");
    }
    return routeError(500, message);
  }
}
