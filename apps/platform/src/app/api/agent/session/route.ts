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

export async function GET(req: NextRequest) {
  const grantor = req.nextUrl.searchParams.get("grantor") || undefined;
  const session = getActiveSession(grantor);
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
  try {
    const body = await req.json();
    const { grantor, signature, constraints, nonce, rawMessage } = body as {
      grantor: string;
      signature: string;
      constraints?: Partial<SessionPolicyConstraints>;
      nonce?: number;
      rawMessage?: string;
    };

    if (!grantor || !signature) {
      return NextResponse.json(
        { error: "Missing required grantor address or wallet signature." },
        { status: 400 }
      );
    }

    const session = createSessionGrant(
      grantor,
      signature,
      constraints,
      nonce ?? Date.now(),
      rawMessage
    );

    return NextResponse.json({
      success: true,
      message: "ERC-7579 Scoped Session Key registered and verified cryptographically.",
      session,
      validatorContract: VALIDATOR_CONTRACT_ADDRESS,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to create agent session" },
      { status: 500 }
    );
  }
}
