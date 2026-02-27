import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/backend/sessionAuth";
import { clearSupabaseSessionCookie } from "@/lib/auth/supabaseSession";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  clearSupabaseSessionCookie(response);
  clearSessionCookie(response);
  return response;
}
