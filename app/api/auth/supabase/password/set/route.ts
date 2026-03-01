import { apiError, apiSuccess } from "@/lib/backend/http";
import { readSupabaseSessionFromRequest } from "@/lib/auth/supabaseSession";
import { getIdentityProfileByUserId } from "@/lib/auth/identityProfiles";
import {
  setAuthUserPassword,
  SupabaseAuthRequestError,
  SupabaseAuthUnavailableError,
} from "@/lib/auth/supabaseAuthProvider";
import { validatePasswordStrength } from "@/lib/backend/password";
import { getRequestId, safeLog } from "@/lib/system/requestContext";

interface PasswordSetBody {
  password?: string;
  confirmPassword?: string;
}

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export async function POST(req: Request) {
  const requestId = getRequestId(req);
  try {
    const session = readSupabaseSessionFromRequest(req);
    if (!session?.userId) {
      return apiError(req, 401, "unauthorized", "Login required.");
    }

    const profile = await getIdentityProfileByUserId(session.userId);
    const role = profile?.role || session.role || "customer";
    if (role !== "customer") {
      return apiError(req, 403, "forbidden", "Only customer accounts can set password here.");
    }

    const body = (await req.json().catch(() => ({}))) as PasswordSetBody;
    const password = safeString(body.password);
    const confirmPassword = safeString(body.confirmPassword);
    if (!password || !confirmPassword) {
      return apiError(req, 400, "password_required", "Password and confirm password are required.");
    }
    if (password !== confirmPassword) {
      return apiError(req, 400, "password_mismatch", "Password and confirm password must match.");
    }

    const passwordError = validatePasswordStrength(password);
    if (passwordError) {
      return apiError(req, 400, "password_weak", passwordError);
    }

    await setAuthUserPassword({
      userId: session.userId,
      password,
    });

    safeLog(
      "auth.supabase.password.set.success",
      {
        requestId,
        route: "/api/auth/supabase/password/set",
        outcome: "success",
      },
      req
    );

    return apiSuccess(req, { updated: true });
  } catch (error) {
    safeLog(
      "auth.supabase.password.set.failed",
      {
        requestId,
        route: "/api/auth/supabase/password/set",
        outcome: "fail",
        reason:
          error instanceof SupabaseAuthUnavailableError
            ? "supabase_auth_not_configured"
            : error instanceof SupabaseAuthRequestError
              ? error.code || "password_set_failed"
              : "password_set_failed",
      },
      req
    );

    if (error instanceof SupabaseAuthUnavailableError) {
      return apiError(req, 503, "supabase_auth_not_configured", "Supabase Auth is not configured.");
    }
    if (error instanceof SupabaseAuthRequestError) {
      return apiError(
        req,
        error.status >= 500 ? 502 : 400,
        "password_set_failed",
        error.message || "Failed to set password."
      );
    }

    return apiError(req, 500, "password_set_failed", "Failed to set password.");
  }
}

