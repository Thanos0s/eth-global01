import type { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/db/repo";
import { ApiError, requireAgentRequest } from "@/lib/api/helpers";
import type { AuthContext } from "./roles";

function extractSessionId(req: Request | NextRequest): string | null {
  const nextReq = req as NextRequest;
  const cookie = nextReq.cookies?.get?.("prism8_session")?.value;
  if (cookie) return cookie;

  // Header cookie fallback if parsed cookies not present
  const cookieHeader = req.headers.get("cookie") ?? "";
  const matchCookie = cookieHeader.match(/prism8_session=([^;]+)/);
  if (matchCookie) return matchCookie[1];

  const auth = req.headers.get("authorization") ?? "";
  const matchAuth = auth.match(/^Bearer\s+(.+)$/i);
  return matchAuth ? matchAuth[1].trim() : null;
}

export function resolveAuthContext(req: Request | NextRequest): AuthContext | null {
  const sessionId = extractSessionId(req);
  if (!sessionId) return null;

  const row = getAuthSession(sessionId);
  if (!row || row.revoked || row.expiresAt < Date.now()) return null;

  return {
    role: row.role as AuthContext["role"],
    address: row.address,
    sessionId,
  };
}

export function requireOperator(req: Request | NextRequest): AuthContext {
  const ctx = resolveAuthContext(req);
  if (!ctx) {
    throw new ApiError("Authentication required. Please sign in with an operator wallet.", 401);
  }
  if (ctx.role !== "operator") {
    throw new ApiError("Operator role required for this action.", 403);
  }
  return ctx;
}

export function requireInvestor(
  req: Request | NextRequest,
  allowedAccountId?: string
): AuthContext {
  const ctx = resolveAuthContext(req);
  if (!ctx) {
    throw new ApiError("Authentication required. Please sign in with your wallet.", 401);
  }
  if (ctx.role !== "investor" && ctx.role !== "operator") {
    throw new ApiError("Investor or operator role required.", 403);
  }
  if (
    allowedAccountId &&
    ctx.role !== "operator" &&
    ctx.address.toLowerCase() !== allowedAccountId.toLowerCase()
  ) {
    throw new ApiError("Cannot act on behalf of another account identifier.", 403);
  }
  return ctx;
}

export function requireOperatorOrAgent(req: Request | NextRequest): AuthContext {
  // Try agent secret first
  try {
    requireAgentRequest(req);
    return {
      role: "agent" as any,
      address: "__agent__",
      sessionId: "__agent__",
    };
  } catch {
    // Fall back to operator authentication
    return requireOperator(req);
  }
}
