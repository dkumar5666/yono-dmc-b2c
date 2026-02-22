import crypto from "node:crypto";
import { getDb } from "@/lib/backend/sqlite";

export type CustomPackageStatus = "new" | "in_progress" | "quoted" | "closed";

export interface CreateCustomPackageRequestInput {
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  destination: string;
  travel_start_date?: string;
  travel_end_date?: string;
  adults?: number;
  children?: number;
  budget_min?: number;
  budget_max?: number;
  currency?: string;
  needs_flights?: boolean;
  needs_stays?: boolean;
  needs_activities?: boolean;
  needs_transfers?: boolean;
  needs_visa?: boolean;
  notes?: string;
}

function sanitizeText(value: unknown, max = 255): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeLongText(value: unknown, max = 4000): string {
  return String(value ?? "").trim().slice(0, max);
}

function sanitizeNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toBoolInt(value: unknown, fallback = false): 0 | 1 {
  if (typeof value === "boolean") return value ? 1 : 0;
  return fallback ? 1 : 0;
}

export function validateCustomPackageInput(input: CreateCustomPackageRequestInput): string | null {
  if (!sanitizeText(input.customer_name, 120)) return "customer_name is required";
  const email = sanitizeText(input.customer_email, 160).toLowerCase();
  if (!email || !email.includes("@")) return "valid customer_email is required";
  if (!sanitizeText(input.customer_phone, 40)) return "customer_phone is required";
  if (!sanitizeText(input.destination, 120)) return "destination is required";
  return null;
}

export function createCustomPackageRequest(input: CreateCustomPackageRequestInput) {
  const db = getDb();
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  db.prepare(
    `INSERT INTO custom_package_requests (
      id, customer_name, customer_email, customer_phone, destination,
      travel_start_date, travel_end_date, adults, children,
      budget_min, budget_max, currency,
      needs_flights, needs_stays, needs_activities, needs_transfers, needs_visa,
      notes, status, admin_notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', '', ?, ?)`
  ).run(
    id,
    sanitizeText(input.customer_name, 120),
    sanitizeText(input.customer_email, 160).toLowerCase(),
    sanitizeText(input.customer_phone, 40),
    sanitizeText(input.destination, 120),
    sanitizeText(input.travel_start_date ?? "", 20),
    sanitizeText(input.travel_end_date ?? "", 20),
    Math.max(1, sanitizeNumber(input.adults, 2)),
    Math.max(0, sanitizeNumber(input.children, 0)),
    sanitizeNumber(input.budget_min, 0),
    sanitizeNumber(input.budget_max, 0),
    sanitizeText(input.currency ?? "INR", 8).toUpperCase(),
    toBoolInt(input.needs_flights, true),
    toBoolInt(input.needs_stays, true),
    toBoolInt(input.needs_activities, true),
    toBoolInt(input.needs_transfers, true),
    toBoolInt(input.needs_visa, false),
    sanitizeLongText(input.notes ?? "", 4000),
    now,
    now
  );

  return getCustomPackageRequestById(id);
}

export function listCustomPackageRequests(status?: CustomPackageStatus | "all") {
  const db = getDb();

  if (status && status !== "all") {
    return db
      .prepare(
        `SELECT *
         FROM custom_package_requests
         WHERE status = ?
         ORDER BY datetime(created_at) DESC`
      )
      .all(status) as Record<string, unknown>[];
  }

  return db
    .prepare(
      `SELECT *
       FROM custom_package_requests
       ORDER BY datetime(created_at) DESC`
    )
    .all() as Record<string, unknown>[];
}

export function getCustomPackageRequestById(id: string) {
  const db = getDb();
  return db
    .prepare("SELECT * FROM custom_package_requests WHERE id = ?")
    .get(id) as Record<string, unknown> | undefined;
}

export function updateCustomPackageRequestStatus(
  id: string,
  status: CustomPackageStatus,
  adminNotes?: string
) {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(
    `UPDATE custom_package_requests
     SET status = ?,
         admin_notes = ?,
         updated_at = ?
     WHERE id = ?`
  ).run(status, sanitizeLongText(adminNotes ?? "", 4000), now, id);

  return getCustomPackageRequestById(id);
}
