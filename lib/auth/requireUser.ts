import "server-only";

import { redirect } from "next/navigation";
import { getAuthenticatedIdentityFromCookies } from "@/lib/auth/supabaseUser";

export async function requireUser(nextPath?: string) {
  const identity = await getAuthenticatedIdentityFromCookies();
  if (!identity) {
    const encodedNext = encodeURIComponent(nextPath || "/my-trips");
    redirect(`/login?next=${encodedNext}`);
  }
  return identity;
}
