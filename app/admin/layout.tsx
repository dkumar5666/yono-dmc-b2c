import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/backend/sessionAuth";
import { readSupabaseSessionFromCookieStore } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import { AdminLayoutClient } from "@/components/admin/AdminLayoutClient";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const supabaseSession = readSupabaseSessionFromCookieStore(cookieStore);
  const profile = supabaseSession ? await getIdentityProfileByUserId(supabaseSession.userId) : null;
  const supabaseRole = profile?.role || supabaseSession?.role;
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;
  const legacySession = token ? verifySessionToken(token) : null;

  const initialUser =
    supabaseSession && supabaseRole === "admin"
      ? {
          username: supabaseSession.email || profile?.email || supabaseSession.userId,
          role: "admin" as const,
        }
      : legacySession
        ? { username: legacySession.username, role: legacySession.role }
        : null;

  return <AdminLayoutClient initialUser={initialUser}>{children}</AdminLayoutClient>;
}
