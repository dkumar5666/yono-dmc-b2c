import "server-only";

import { cookies } from "next/headers";
import { getIdentityProfileByUserId, IdentityProfile } from "@/lib/auth/identityProfiles";
import {
  IdentityRole,
  readSupabaseSessionFromCookieStore,
  readSupabaseSessionFromRequest,
} from "@/lib/auth/supabaseSession";

export interface AuthenticatedIdentity {
  userId: string;
  email?: string;
  phone?: string;
  fullName?: string;
  role?: IdentityRole;
  profile?: IdentityProfile | null;
}

export function getAuthenticatedIdentityFromRequest(req: Request): AuthenticatedIdentity | null {
  const session = readSupabaseSessionFromRequest(req);
  if (!session) return null;
  return {
    userId: session.userId,
    email: session.email,
    phone: session.phone,
    fullName: session.fullName,
    role: session.role,
  };
}

export async function getAuthenticatedIdentityFromCookies(): Promise<AuthenticatedIdentity | null> {
  const cookieStore = await cookies();
  const session = readSupabaseSessionFromCookieStore(cookieStore);
  if (!session) return null;

  const profile = await getIdentityProfileByUserId(session.userId);

  return {
    userId: session.userId,
    email: session.email,
    phone: session.phone,
    fullName: session.fullName,
    role: profile?.role || session.role,
    profile,
  };
}
