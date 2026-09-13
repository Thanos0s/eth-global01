import { NextRequest, NextResponse } from "next/server";
import {
  getActiveSession,
  createSessionGrant,
  SessionPolicyConstraints,
  SESSION_KEY_EIP712_DOMAIN,
  SESSION_KEY_EIP712_TYPES,
  VALIDATOR_CONTRACT_ADDRESS,
  HERMES_AGENT_ADDRESS,
} from "@/lib/hermes/sessionPolicy";
import { requireInvestor } from "@/lib/auth/middleware";
import { checkRateLimit, getClientIp } from "@/lib/api/rateLimit";
import { auditLog } from "@/lib/audit/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const grantor = req.nextUrl.searchParams.get("grantor") || undefined;
  const session = await getActiveSession(grantor);
  return NextResponse.json({
    success: true,
    session,
    eip712: {
      domain: SESSION_KEY_EIP712_DOMAIN,
      types: SESSION_KEY_EIP712_TYPES,
      validatorContract: VALIDATOR_CONTRACT_ADDRESS,
      agentAddress: HERMES_AGENT_ADDRESS,
    },
  });
}

export async function POST(req: NextRequest) {
  checkRateLimit(getClientIp(req), 30);

  try {
    const body = await req.json();
    const { grantor, signature, constraints, nonce, chainId, validUntil, rawMessage } = body as {
      grantor: string;
      signature: string;
      constraints?: Partial<SessionPolicyConstraints>;
      nonce?: number;
      chainId?: number;
      validUntil?: number;
      rawMessage?: string;
    };

    if (!grantor || !signature) {
      return NextResponse.json(
        { error: "Missing required grantor address or wallet signature." },
        { status: 400 }
      );
    }

    // Authenticated investor check (user must match grantor or be operator)
    const ctx = await requireInvestor(req, grantor);

    const policyNonce = nonce ?? Date.now();
    const session = await createSessionGrant(
      grantor,
      signature,
      constraints,
      policyNonce,
      chainId,
      validUntil,
      rawMessage
    );

    auditLog({
      actor: ctx.address,
      role: ctx.role,
      action: "REGISTER_AGENT_SESSION",
      resource: `session:${session.sessionId}`,
      status: "OK",
      detail: { grantor, maxSpendHbar: session.constraints.maxSpendHbar, nonce: policyNonce },
      ip: getClientIp(req),
    });

    return NextResponse.json({
      success: true,
      message: "ERC-7579 Scoped Session Key registered and verified cryptographically.",
      session,
      validatorContract: VALIDATOR_CONTRACT_ADDRESS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create agent session" },
      { status: err.status || 400 }
    );
  }
}
