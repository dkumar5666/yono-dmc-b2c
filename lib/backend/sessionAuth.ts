import crypto from "node:crypto";
import { NextResponse } from "next/server";

export type UserRole = "admin" | "editor";

interface UserRecord {
  username: string;
  password: string;
  role: UserRole;
}

interface SessionPayload {
  username: string;
  role: UserRole;
  exp: number;
}

export const AUTH_COOKIE_NAME = "yono_admin_session";

function base64UrlEncode(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signingSecret(): string {
  return (
    process.env.AUTH_SESSION_SECRET ??
    process.env.ADMIN_API_TOKEN ??
    "dev-insecure-secret-change-me"
  );
}

function getConfiguredUsers(): UserRecord[] {
  const users: UserRecord[] = [];
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const editorUsername = process.env.EDITOR_USERNAME;
  const editorPassword = process.env.EDITOR_PASSWORD;

  if (adminUsername && adminPassword) {
    users.push({ username: adminUsername, password: adminPassword, role: "admin" });
  }
  if (editorUsername && editorPassword) {
    users.push({
      username: editorUsername,
      password: editorPassword,
      role: "editor",
    });
  }

  return users;
}

function sign(input: string): string {
  return crypto.createHmac("sha256", signingSecret()).update(input).digest("hex");
}

function parseCookieHeader(req: Request, key: string): string | null {
  const cookieHeader = req.headers.get("cookie");
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(";").map((part) => part.trim());
  for (const entry of cookies) {
    const idx = entry.indexOf("=");
    if (idx < 0) continue;
    const name = entry.slice(0, idx);
    const value = entry.slice(idx + 1);
    if (name === key) return decodeURIComponent(value);
  }
  return null;
}

export function authenticateCredentials(
  username: string,
  password: string
): { username: string; role: UserRole } | null {
  const users = getConfiguredUsers();
  const found = users.find(
    (user) => user.username === username.trim() && user.password === password
  );
  if (!found) return null;
  return { username: found.username, role: found.role };
}

export function createSessionToken(user: {
  username: string;
  role: UserRole;
}): string {
  const payload: SessionPayload = {
    username: user.username,
    role: user.role,
    exp: Date.now() + 1000 * 60 * 60 * 8,
  };
  const encoded = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;
  if (sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(base64UrlDecode(encoded)) as SessionPayload;
    if (!payload.username || !payload.role || !payload.exp) return null;
    if (payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "editor") return null;
    return payload;
  } catch {
    return null;
  }
}

export function getSessionFromRequest(req: Request): SessionPayload | null {
  const token = parseCookieHeader(req, AUTH_COOKIE_NAME);
  if (!token) return null;
  return verifySessionToken(token);
}

export function applySessionCookie(response: NextResponse, token: string): void {
  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(AUTH_COOKIE_NAME, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export function areAuthUsersConfigured(): boolean {
  return getConfiguredUsers().length > 0;
}
