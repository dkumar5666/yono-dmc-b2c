import "server-only";

import { consumeRateLimit } from "@/lib/backend/rateLimit";
import { SupabaseRestClient } from "@/lib/core/supabase-rest";

type OtpStatus = "sent" | "verified" | "failed" | "blocked";

const fallbackPhoneLastSentAt = new Map<string, number>();

function parseIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return value;
}

function nowIso(): string {
  return new Date().toISOString();
}

function nowMs(): number {
  return Date.now();
}

function isMissingTableError(error: unknown, table: string): boolean {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  return (
    message.includes(`relation "${table.toLowerCase()}" does not exist`) ||
    message.includes("42p01")
  );
}

export function getOtpPolicy() {
  return {
    perPhonePerHour: parseIntEnv("OTP_RATE_LIMIT_PER_PHONE", 5),
    perIpPerHour: parseIntEnv("OTP_RATE_LIMIT_PER_IP", 20),
    cooldownSeconds: parseIntEnv("OTP_COOLDOWN_SECONDS", 60),
  };
}

export function normalizePhoneE164(input: string, country?: string): string {
  const raw = (input || "").trim();
  if (!raw) return "";

  if (raw.startsWith("+")) {
    const digits = raw.replace(/[^\d+]/g, "");
    return /^\+[1-9]\d{7,14}$/.test(digits) ? digits : "";
  }

  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";

  const countryCode = (country || "").trim().toUpperCase();
  if (countryCode === "IN" || (!countryCode && digits.length === 10)) {
    if (digits.length === 10) return `+91${digits}`;
    if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
    return "";
  }

  if (/^[1-9]\d{7,14}$/.test(digits)) {
    return `+${digits}`;
  }

  return "";
}

export function isValidOtpCode(value: string): boolean {
  return /^\d{4,8}$/.test((value || "").trim());
}

export function maskPhone(value: string): string {
  const phone = (value || "").trim();
  if (!phone.startsWith("+")) return phone;
  if (phone.length <= 6) return phone;
  const tail = phone.slice(-4);
  const visiblePrefix = phone.slice(0, 3);
  return `${visiblePrefix}****${tail}`;
}

async function getDbClient(): Promise<SupabaseRestClient | null> {
  try {
    return new SupabaseRestClient();
  } catch {
    return null;
  }
}

async function countRequestsInWindow(
  db: SupabaseRestClient,
  filter: { phone?: string; ip?: string; status?: OtpStatus },
  sinceIso: string
): Promise<number | null> {
  const query = new URLSearchParams({
    select: "id,created_at",
    created_at: `gte.${sinceIso}`,
    limit: "500",
  });
  if (filter.phone) query.set("phone_e164", `eq.${filter.phone}`);
  if (filter.ip) query.set("ip", `eq.${filter.ip}`);
  if (filter.status) query.set("status", `eq.${filter.status}`);

  try {
    const rows = await db.selectMany<Record<string, unknown>>("otp_requests", query);
    return rows.length;
  } catch (error) {
    if (isMissingTableError(error, "otp_requests")) return null;
    return null;
  }
}

async function getLatestSentAt(
  db: SupabaseRestClient,
  phoneE164: string
): Promise<number | null> {
  const query = new URLSearchParams({
    select: "created_at,status",
    phone_e164: `eq.${phoneE164}`,
    status: "eq.sent",
    order: "created_at.desc",
    limit: "1",
  });
  try {
    const row = await db.selectSingle<Record<string, unknown>>("otp_requests", query);
    const createdAt = typeof row?.created_at === "string" ? Date.parse(row.created_at) : NaN;
    if (!Number.isFinite(createdAt)) return null;
    return createdAt;
  } catch (error) {
    if (isMissingTableError(error, "otp_requests")) return null;
    return null;
  }
}

async function readBlockSeconds(
  db: SupabaseRestClient,
  key: string
): Promise<number | null> {
  const query = new URLSearchParams({
    select: "blocked_until",
    key: `eq.${key}`,
    limit: "1",
  });
  try {
    const row = await db.selectSingle<Record<string, unknown>>("otp_blocks", query);
    const blockedUntil =
      typeof row?.blocked_until === "string" ? Date.parse(row.blocked_until) : NaN;
    if (!Number.isFinite(blockedUntil)) return 0;
    const remaining = Math.ceil((blockedUntil - nowMs()) / 1000);
    return Math.max(0, remaining);
  } catch (error) {
    if (isMissingTableError(error, "otp_blocks")) return null;
    return null;
  }
}

async function setBlock(
  db: SupabaseRestClient,
  key: string,
  blockedForSeconds: number,
  reason: string
): Promise<void> {
  const blockedUntil = new Date(nowMs() + blockedForSeconds * 1000).toISOString();
  try {
    const updated = await db.updateSingle<Record<string, unknown>>(
      "otp_blocks",
      new URLSearchParams({ key: `eq.${key}`, select: "key" }),
      {
        blocked_until: blockedUntil,
        reason,
      }
    );
    if (updated) return;
    await db.insertSingle<Record<string, unknown>>("otp_blocks", {
      key,
      blocked_until: blockedUntil,
      reason,
    });
  } catch {
    // Best effort only.
  }
}

export async function logOtpRequest(params: {
  phoneE164: string;
  ip: string;
  userAgent: string;
  status: OtpStatus;
  meta?: Record<string, unknown>;
}): Promise<void> {
  const db = await getDbClient();
  if (!db) return;
  try {
    await db.insertSingle<Record<string, unknown>>("otp_requests", {
      phone_e164: params.phoneE164,
      ip: params.ip || null,
      user_agent: params.userAgent || null,
      status: params.status,
      provider: "twilio",
      meta: params.meta || {},
      created_at: nowIso(),
    });
  } catch {
    // Best effort only.
  }
}

function fallbackCooldownRemaining(phoneE164: string, cooldownSeconds: number): number {
  const sentAt = fallbackPhoneLastSentAt.get(phoneE164);
  if (!sentAt) return 0;
  const remaining = Math.ceil((sentAt + cooldownSeconds * 1000 - nowMs()) / 1000);
  return Math.max(0, remaining);
}

function markFallbackSent(phoneE164: string) {
  fallbackPhoneLastSentAt.set(phoneE164, nowMs());
}

export async function checkOtpSendGuards(params: {
  phoneE164: string;
  ip: string;
  policy?: ReturnType<typeof getOtpPolicy>;
}): Promise<{ ok: true } | { ok: false; code: "RATE_LIMITED"; retryAfter: number }> {
  const policy = params.policy || getOtpPolicy();
  const db = await getDbClient();
  const sinceIso = new Date(nowMs() - 60 * 60 * 1000).toISOString();

  if (db) {
    const phoneBlockSeconds = await readBlockSeconds(db, `phone:${params.phoneE164}`);
    if ((phoneBlockSeconds || 0) > 0) {
      return { ok: false, code: "RATE_LIMITED", retryAfter: phoneBlockSeconds || 0 };
    }
    const ipBlockSeconds = await readBlockSeconds(db, `ip:${params.ip}`);
    if ((ipBlockSeconds || 0) > 0) {
      return { ok: false, code: "RATE_LIMITED", retryAfter: ipBlockSeconds || 0 };
    }

    const latestSentAt = await getLatestSentAt(db, params.phoneE164);
    if (latestSentAt && Number.isFinite(latestSentAt)) {
      const remaining = Math.ceil((latestSentAt + policy.cooldownSeconds * 1000 - nowMs()) / 1000);
      if (remaining > 0) {
        return { ok: false, code: "RATE_LIMITED", retryAfter: remaining };
      }
    }

    const phoneCount = await countRequestsInWindow(
      db,
      { phone: params.phoneE164, status: "sent" },
      sinceIso
    );
    if (typeof phoneCount === "number" && phoneCount >= policy.perPhonePerHour) {
      await setBlock(db, `phone:${params.phoneE164}`, policy.cooldownSeconds, "phone_rate_limit");
      return { ok: false, code: "RATE_LIMITED", retryAfter: policy.cooldownSeconds };
    }

    const ipCount = await countRequestsInWindow(db, { ip: params.ip, status: "sent" }, sinceIso);
    if (typeof ipCount === "number" && ipCount >= policy.perIpPerHour) {
      await setBlock(db, `ip:${params.ip}`, policy.cooldownSeconds, "ip_rate_limit");
      return { ok: false, code: "RATE_LIMITED", retryAfter: policy.cooldownSeconds };
    }
  }

  const cooldownRemaining = fallbackCooldownRemaining(params.phoneE164, policy.cooldownSeconds);
  if (cooldownRemaining > 0) {
    return { ok: false, code: "RATE_LIMITED", retryAfter: cooldownRemaining };
  }

  const phoneFallback = consumeRateLimit(
    `otp-send-phone:${params.phoneE164}`,
    policy.perPhonePerHour,
    60 * 60 * 1000
  );
  if (!phoneFallback.ok) {
    return { ok: false, code: "RATE_LIMITED", retryAfter: phoneFallback.retryAfterSeconds };
  }

  const ipFallback = consumeRateLimit(
    `otp-send-ip:${params.ip}`,
    policy.perIpPerHour,
    60 * 60 * 1000
  );
  if (!ipFallback.ok) {
    return { ok: false, code: "RATE_LIMITED", retryAfter: ipFallback.retryAfterSeconds };
  }

  return { ok: true };
}

export async function markOtpSent(phoneE164: string) {
  markFallbackSent(phoneE164);
}

export async function checkOtpVerifyGuards(params: {
  phoneE164: string;
  ip: string;
}): Promise<{ ok: true } | { ok: false; code: "RATE_LIMITED"; retryAfter: number }> {
  const db = await getDbClient();
  const sinceIso = new Date(nowMs() - 60 * 60 * 1000).toISOString();

  if (db) {
    const failedPhone = await countRequestsInWindow(
      db,
      { phone: params.phoneE164, status: "failed" },
      sinceIso
    );
    if (typeof failedPhone === "number" && failedPhone >= 10) {
      await setBlock(db, `phone:${params.phoneE164}`, 15 * 60, "verify_failed_too_many");
      return { ok: false, code: "RATE_LIMITED", retryAfter: 15 * 60 };
    }

    const failedIp = await countRequestsInWindow(db, { ip: params.ip, status: "failed" }, sinceIso);
    if (typeof failedIp === "number" && failedIp >= 40) {
      await setBlock(db, `ip:${params.ip}`, 15 * 60, "verify_ip_failed_too_many");
      return { ok: false, code: "RATE_LIMITED", retryAfter: 15 * 60 };
    }
  }

  const verifyPhoneFallback = consumeRateLimit(`otp-verify-phone:${params.phoneE164}`, 12, 60 * 60 * 1000);
  if (!verifyPhoneFallback.ok) {
    return { ok: false, code: "RATE_LIMITED", retryAfter: verifyPhoneFallback.retryAfterSeconds };
  }
  const verifyIpFallback = consumeRateLimit(`otp-verify-ip:${params.ip}`, 40, 60 * 60 * 1000);
  if (!verifyIpFallback.ok) {
    return { ok: false, code: "RATE_LIMITED", retryAfter: verifyIpFallback.retryAfterSeconds };
  }

  return { ok: true };
}
