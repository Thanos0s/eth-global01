import crypto from "node:crypto";
import { verifyTypedData, verifyMessage } from "ethers";
import { ApiError } from "@/lib/api/helpers";
import {
  saveAgentSession,
  getAgentSession,
  getActiveAgentSession,
  getAgentSessionByGrantor,
  updateAgentSessionStatus,
  validateAndSpendAgentSession,
} from "@/lib/db/repo";

export interface SessionPolicyConstraints {
  maxSpendHbar: number;
  maxFlowRateMonthlyUsd: number;
  allowedActions: string[];
  durationHours: number;
}

export interface AgentSessionRecord {
  sessionId: string;
  grantor: string;
  agentId: string;
  agentAddress: string;
  validatorContract: string;
  constraints: SessionPolicyConstraints;
  spentHbar: number;
  activeStreamsCount: number;
  nonce: number;
  chainId: number;
  createdAt: number;
  expiresAt: number;
  signature: string;
  signatureType: "EIP712";
  status: "ACTIVE" | "EXPIRED" | "REVOKED";
}

export interface PolicyValidationResult {
  allowed: boolean;
  reason?: string;
  remainingHbar: number;
  session?: AgentSessionRecord | null;
}

export const VALIDATOR_CONTRACT_ADDRESS =
  process.env.SESSION_VALIDATOR_ADDRESS ?? "0x7579C0de00000000000000000000000000007579";
export const HERMES_AGENT_ADDRESS =
  process.env.HERMES_AGENT_ADDRESS ?? "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7";
export const DEFAULT_CHAIN_ID = Number(process.env.SESSION_CHAIN_ID ?? "84532"); // Base Sepolia

export const SESSION_KEY_EIP712_DOMAIN = {
  name: "Prism8SessionValidator",
  version: "1",
  chainId: DEFAULT_CHAIN_ID,
  verifyingContract: VALIDATOR_CONTRACT_ADDRESS,
};

export const SESSION_KEY_EIP712_TYPES = {
  SessionPolicy: [
    { name: "grantor", type: "address" },
    { name: "agent", type: "address" },
    { name: "maxSpendHbar", type: "uint256" },
    { name: "maxFlowMonthlyUsd", type: "uint256" },
    { name: "validUntil", type: "uint256" },
    { name: "nonce", type: "uint256" },
  ],
};

function mapDbSessionToPolicySession(row: any): AgentSessionRecord {
  const allowedActions = Array.isArray(row.allowedActions)
    ? row.allowedActions
    : Array.isArray(row.allowed_actions)
    ? row.allowed_actions
    : typeof row.allowed_actions === "string"
    ? JSON.parse(row.allowed_actions)
    : [];

  const createdAt = Number(row.createdAt ?? row.created_at ?? Date.now());
  const expiresAt = Number(row.expiresAt ?? row.expires_at ?? Date.now());

  return {
    sessionId: row.id,
    grantor: row.grantor,
    agentId: "hermes-agentic-operator",
    agentAddress: row.agentAddress ?? row.agent_address,
    validatorContract: row.validatorContract ?? row.validator_contract,
    constraints: {
      maxSpendHbar: Number(row.maxSpendHbar ?? row.max_spend_hbar),
      maxFlowRateMonthlyUsd: Number(row.maxFlowMonthlyUsd ?? row.max_flow_monthly_usd),
      allowedActions,
      durationHours: Math.max(1, Math.round((expiresAt - createdAt) / 3600000)),
    },
    spentHbar: Number(row.spentHbar ?? row.spent_hbar ?? 0),
    activeStreamsCount: Number(row.activeStreams ?? row.active_streams ?? 0),
    nonce: Number(row.nonce),
    chainId: Number(row.chainId ?? row.chain_id),
    createdAt,
    expiresAt,
    signature: row.signature,
    signatureType: "EIP712",
    status: row.status,
  };
}

export async function getActiveSession(grantorAddress?: string): Promise<AgentSessionRecord | null> {
  if (!grantorAddress) return null;
  const record = await getActiveAgentSession(grantorAddress);
  return record ? mapDbSessionToPolicySession(record) : null;
}

export async function getSessionById(sessionId: string): Promise<AgentSessionRecord | null> {
  const record = await getAgentSession(sessionId);
  return record ? mapDbSessionToPolicySession(record) : null;
}

export async function createSessionGrant(
  grantor: string,
  signature: string,
  customConstraints?: Partial<SessionPolicyConstraints>,
  nonce: number = Date.now(),
  chainId: number = DEFAULT_CHAIN_ID,
  validUntilOverride?: number,  // client-signed validUntil — must match what was signed
  rawMessage?: string
): Promise<AgentSessionRecord> {
  const expectedSigner = grantor.toLowerCase();

  const constraints: SessionPolicyConstraints = {
    maxSpendHbar: customConstraints?.maxSpendHbar ?? 5.0,
    maxFlowRateMonthlyUsd: customConstraints?.maxFlowRateMonthlyUsd ?? 5000,
    allowedActions: customConstraints?.allowedActions ?? [
      "ORACLE_USPS_X402",
      "HCS_CONSENSUS_AUDIT",
      "SUBGRAPH_HOLDER_DISCOVERY",
      "CFA_YIELD_STREAM_START",
      "CFA_YIELD_STREAM_ADJUST",
      "COMPLIANCE_FREEZE",
    ],
    durationHours: customConstraints?.durationHours ?? 24,
  };

  // Use the client's validUntil if provided — it MUST match what was signed
  const validUntilSec = validUntilOverride
    ?? Math.floor((Date.now() + constraints.durationHours * 3600000) / 1000);

  // 1. Verification (EIP-712 with fallback to personal_sign)
  const domain = {
    ...SESSION_KEY_EIP712_DOMAIN,
    chainId,
  };

  const typedValue = {
    grantor,
    agent: HERMES_AGENT_ADDRESS,
    maxSpendHbar: BigInt(Math.floor(constraints.maxSpendHbar * 1e18)),
    maxFlowMonthlyUsd: BigInt(constraints.maxFlowRateMonthlyUsd),
    validUntil: BigInt(validUntilSec),
    nonce: BigInt(nonce),
  };

  let recovered = "";
  let signatureType: "EIP712" | "PERSONAL_SIGN" = "EIP712";

  try {
    recovered = verifyTypedData(domain, SESSION_KEY_EIP712_TYPES, typedValue, signature);
  } catch (err: any) {
    console.warn("[sessionPolicy] verifyTypedData error:", err.message);
  }

  // Fallback to personal_sign verification if EIP-712 didn't match and rawMessage is provided
  if (recovered.toLowerCase() !== expectedSigner && rawMessage) {
    try {
      const personalRecovered = verifyMessage(rawMessage, signature);
      if (personalRecovered.toLowerCase() === expectedSigner) {
        recovered = personalRecovered;
        signatureType = "PERSONAL_SIGN";
      }
    } catch (err: any) {
      console.warn("[sessionPolicy] verifyMessage fallback error:", err.message);
    }
  }

  if (recovered.toLowerCase() !== expectedSigner) {
    console.error("[sessionPolicy] Signature mismatch", {
      expected: expectedSigner,
      recovered: recovered.toLowerCase(),
      signatureType,
      domain,
      typedValue: { ...typedValue, maxSpendHbar: typedValue.maxSpendHbar.toString(), maxFlowMonthlyUsd: typedValue.maxFlowMonthlyUsd.toString(), validUntil: typedValue.validUntil.toString(), nonce: typedValue.nonce.toString() },
    });
    throw new ApiError("Session signature recovered address does not match grantor address", 401);
  }

  // 2. Prevent replay across policies (UNIQUE constraint check)
  const existing = await getAgentSessionByGrantor(expectedSigner, nonce);
  if (existing) {
    throw new ApiError("Session policy nonce already used. Please increment policy nonce.", 409);
  }

  // 3. Persist to Database via repository adapter
  const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + constraints.durationHours * 3600000;

  await saveAgentSession({
    id: sessionId,
    grantor: expectedSigner,
    agentAddress: HERMES_AGENT_ADDRESS,
    validatorContract: VALIDATOR_CONTRACT_ADDRESS,
    maxSpendHbar: constraints.maxSpendHbar,
    maxFlowMonthlyUsd: constraints.maxFlowRateMonthlyUsd,
    allowedActions: constraints.allowedActions,
    chainId,
    nonce,
    expiresAt,
    signature,
    signatureType: signatureType === "PERSONAL_SIGN" ? "PERSONAL_SIGN" : "EIP712",
    spentHbar: 0,
    activeStreams: 0,
    status: "ACTIVE",
    createdAt: now,
  });

  const created = await getSessionById(sessionId);
  return created!;
}

export async function validateAndSpendSession(
  sessionId: string,
  action: string,
  spendHbar: number = 0,
  flowRateMonthly: number = 0,
  requestNonce: string = crypto.randomUUID()
): Promise<PolicyValidationResult> {
  const result = await validateAndSpendAgentSession(
    sessionId,
    action,
    spendHbar,
    flowRateMonthly,
    requestNonce
  );

  return {
    allowed: result.allowed,
    reason: result.reason,
    remainingHbar: result.remainingHbar,
    session: result.session ? mapDbSessionToPolicySession(result.session) : null,
  };
}

export async function revokeSession(sessionId: string): Promise<void> {
  return updateAgentSessionStatus(sessionId, "REVOKED");
}
