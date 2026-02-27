import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { IdentityRole } from "@/lib/auth/supabaseSession";
import { getAuthenticatedIdentityFromCookies } from "@/lib/auth/supabaseUser";
import { AUTH_COOKIE_NAME, verifySessionToken } from "@/lib/backend/sessionAuth";

export async function requireRole(required: IdentityRole | IdentityRole[], nextPath?: string) {
  const allowed = Array.isArray(required) ? required : [required];
  const identity = await getAuthenticatedIdentityFromCookies();
  if (!identity && allowed.includes("admin")) {
    const cookieStore = await cookies();
    const legacyToken = cookieStore.get(AUTH_COOKIE_NAME)?.value;
    const legacy = legacyToken ? verifySessionToken(legacyToken) : null;
    if (legacy?.role === "admin") {
      return {
        userId: `admin:${legacy.username}`,
        email: legacy.username,
        fullName: legacy.username,
        role: "admin" as const,
        profile: null,
      };
    }
  }

  if (!identity) {
    const encodedNext = encodeURIComponent(nextPath || "/");
    if (allowed.includes("admin")) redirect(`/admin/login?next=${encodedNext}`);
    if (allowed.includes("agent")) redirect(`/agent/login?next=${encodedNext}`);
    if (allowed.includes("supplier")) redirect(`/supplier/login?next=${encodedNext}`);
    redirect(`/login?next=${encodedNext}`);
  }

  const role = identity.role;
  if (!role || !allowed.includes(role)) {
    if (allowed.includes("admin")) redirect("/admin/login");
    if (allowed.includes("agent")) redirect("/agent/login");
    if (allowed.includes("supplier")) redirect("/supplier/login");
    redirect("/");
  }

  return identity;
}
