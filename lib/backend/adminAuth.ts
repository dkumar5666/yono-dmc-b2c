import { NextResponse } from "next/server";
import { UserRole, getSessionFromRequest } from "@/lib/backend/sessionAuth";

function extractAdminToken(req: Request): string | null {
  const headerToken = req.headers.get("x-admin-token");
  if (headerToken) return headerToken;

  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const [scheme, token] = auth.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function requireRoles(
  req: Request,
  allowedRoles: UserRole[]
): NextResponse | null {
  const session = getSessionFromRequest(req);
  if (session && allowedRoles.includes(session.role)) {
    return null;
  }

  // Backward compatible emergency token path.
  const expectedToken = process.env.ADMIN_API_TOKEN;
  const providedToken = extractAdminToken(req);
  if (expectedToken && providedToken === expectedToken) {
    return null;
  }

  return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
}

export function requireAdmin(req: Request): NextResponse | null {
  return requireRoles(req, ["admin"]);
}
