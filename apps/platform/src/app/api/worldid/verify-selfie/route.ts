import { NextResponse } from "next/server";
import {
  verifySelfieCredential,
  WorldProofError,
} from "@/lib/worldid/verification";
import { requireInvestor } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const runtime = "nodejs";

export async function POST(request: Request) {
  checkRateLimit(getClientIp(request), 30);
  const ctx = requireInvestor(request);

  try {
    const verification = await verifySelfieCredential(
      await request.json().catch(() => null)
    );
    return NextResponse.json({
      success: true,
      world_verified: true,
      check: "selfie",
      credential: verification.credential,
    });
  } catch (error) {
    if (error instanceof WorldProofError) {
      return NextResponse.json(
        { error: error.message, code: error.code, details: error.details },
        { status: error.status }
      );
    }
    throw error;
  }
}
