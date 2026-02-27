import "server-only";

export interface SupabasePublicAuthConfig {
  url: string;
  anonKey: string;
}

function pickFirst(values: Array<string | undefined | null>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) return trimmed;
  }
  return "";
}

export function getSupabasePublicAuthConfig(): SupabasePublicAuthConfig | null {
  const url = pickFirst([
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_URL,
  ]);
  const anonKey = pickFirst([
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    process.env.SUPABASE_ANON_KEY,
    process.env.SUPABASE_PUBLISHABLE_KEY,
  ]);

  if (!url || !anonKey) return null;
  return { url, anonKey };
}

export function getSiteUrlFallback(): string | null {
  const value = pickFirst([
    process.env.SITE_URL,
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.APP_URL,
    process.env.NEXTAUTH_URL,
  ]);
  return value || null;
}
