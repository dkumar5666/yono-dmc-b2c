import { NextResponse } from "next/server";
import {
  areAuthUsersConfigured,
  getSessionFromRequest,
} from "@/lib/backend/sessionAuth";

export async function GET(req: Request) {
  if (!areAuthUsersConfigured()) {
    return NextResponse.json(
      { error: "Auth users are not configured in environment" },
      { status: 500 }
    );
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    user: { username: session.username, role: session.role },
  });
}
