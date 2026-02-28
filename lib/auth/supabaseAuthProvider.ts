import "server-only";

import { getSupabasePublicAuthConfig } from "@/lib/auth/supabaseConfig";
import { SupabaseRestClient, getSupabaseConfig } from "@/lib/core/supabase-rest";

interface SupabaseAuthApiError {
  code?: string;
  msg?: string;
  message?: string;
  error?: string;
  error_description?: string;
}

type GenericRow = Record<string, unknown>;

export interface SupabaseAuthSessionResult {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: {
    id?: string;
    email?: string;
    phone?: string;
    user_metadata?: Record<string, unknown>;
    app_metadata?: Record<string, unknown>;
  };
}

export class SupabaseAuthUnavailableError extends Error {
  constructor(message = "Supabase Auth is not configured") {
    super(message);
    this.name = "SupabaseAuthUnavailableError";
  }
}

export class SupabaseAuthRequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = "SupabaseAuthRequestError";
  }
}

function toMessage(payload: SupabaseAuthApiError | null, fallback: string): string {
  return (
    payload?.message ||
    payload?.error_description ||
    payload?.msg ||
    payload?.error ||
    fallback
  );
}

async function parseJsonSafe<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function authPost<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const config = getSupabasePublicAuthConfig();
  if (!config) {
    throw new SupabaseAuthUnavailableError();
  }

  const response = await fetch(`${config.url}/auth/v1${path}`, {
    method: "POST",
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await parseJsonSafe<SupabaseAuthApiError>(response);
    throw new SupabaseAuthRequestError(
      toMessage(payload, `Supabase auth request failed (${response.status})`),
      response.status,
      payload?.code
    );
  }

  const payload = await parseJsonSafe<T>(response);
  if (!payload) {
    throw new SupabaseAuthRequestError("Supabase auth response was empty.", 502);
  }
  return payload;
}

async function authAdminRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getSupabaseConfig();
  const publicConfig = getSupabasePublicAuthConfig();
  if (!config || !publicConfig) {
    throw new SupabaseAuthUnavailableError();
  }

  const response = await fetch(`${config.url}/auth/v1${path}`, {
    method: init?.method || "GET",
    headers: {
      apikey: config.serviceRoleKey,
      Authorization: `Bearer ${config.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    body: init?.body,
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await parseJsonSafe<SupabaseAuthApiError>(response);
    throw new SupabaseAuthRequestError(
      toMessage(payload, `Supabase admin auth request failed (${response.status})`),
      response.status,
      payload?.code
    );
  }

  const payload = await parseJsonSafe<T>(response);
  if (!payload) {
    throw new SupabaseAuthRequestError("Supabase admin auth response was empty.", 502);
  }
  return payload;
}

function normalizeUserId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

async function getUserIdByPhone(phone: string): Promise<string | null> {
  try {
    const db = new SupabaseRestClient();
    const profile = await db.selectSingle<GenericRow>(
      "profiles",
      new URLSearchParams({
        select: "id,phone",
        phone: `eq.${phone}`,
      })
    );
    return normalizeUserId(profile?.id);
  } catch {
    return null;
  }
}

async function ensurePhoneUserId(params: {
  phone: string;
  fullName?: string;
}): Promise<string> {
  const existingUserId = await getUserIdByPhone(params.phone);
  if (existingUserId) {
    return existingUserId;
  }

  const created = await authAdminRequest<{ id?: string }>("/admin/users", {
    method: "POST",
    body: JSON.stringify({
      phone: params.phone,
      phone_confirm: true,
      user_metadata: {
        full_name: params.fullName || "User",
      },
      app_metadata: {
        provider: "phone",
      },
    }),
  }).catch(async (error) => {
    if (error instanceof SupabaseAuthRequestError && error.status === 422) {
      const existingAfterConflict = await getUserIdByPhone(params.phone);
      if (existingAfterConflict) {
        return { id: existingAfterConflict };
      }
    }
    throw error;
  });

  const userId = normalizeUserId(created.id);
  if (!userId) {
    throw new SupabaseAuthRequestError("Failed to create Supabase phone user.", 502);
  }
  return userId;
}

export async function createPasswordSessionForVerifiedPhone(params: {
  phone: string;
  fullName?: string;
}): Promise<SupabaseAuthSessionResult> {
  const userId = await ensurePhoneUserId(params);
  const tempPassword = `yono_${Math.random().toString(36).slice(2)}_${Date.now()}`;

  await authAdminRequest(`/admin/users/${encodeURIComponent(userId)}`, {
    method: "PUT",
    body: JSON.stringify({
      phone: params.phone,
      phone_confirm: true,
      password: tempPassword,
      user_metadata: {
        full_name: params.fullName || "User",
      },
    }),
  });

  return authPost<SupabaseAuthSessionResult>("/token?grant_type=password", {
    phone: params.phone,
    password: tempPassword,
  });
}

export async function exchangeOAuthCodeForSession(params: {
  authCode: string;
  codeVerifier: string;
}): Promise<SupabaseAuthSessionResult> {
  return authPost<SupabaseAuthSessionResult>("/token?grant_type=pkce", {
    auth_code: params.authCode,
    code_verifier: params.codeVerifier,
  });
}

export async function signInWithPassword(params: {
  email: string;
  password: string;
}): Promise<SupabaseAuthSessionResult> {
  return authPost<SupabaseAuthSessionResult>("/token?grant_type=password", {
    email: params.email,
    password: params.password,
  });
}

export async function sendPhoneOtp(params: { phone: string }): Promise<void> {
  await authPost<Record<string, never>>("/otp", {
    phone: params.phone,
    create_user: true,
  });
}

export async function sendEmailOtp(params: { email: string }): Promise<void> {
  await authPost<Record<string, never>>("/otp", {
    email: params.email,
    create_user: true,
  });
}

export async function verifyPhoneOtp(params: {
  phone: string;
  token: string;
}): Promise<SupabaseAuthSessionResult> {
  return authPost<SupabaseAuthSessionResult>("/verify", {
    phone: params.phone,
    token: params.token,
    type: "sms",
  });
}

export async function verifyEmailOtp(params: {
  email: string;
  token: string;
}): Promise<SupabaseAuthSessionResult> {
  return authPost<SupabaseAuthSessionResult>("/verify", {
    email: params.email,
    token: params.token,
    type: "email",
  });
}
