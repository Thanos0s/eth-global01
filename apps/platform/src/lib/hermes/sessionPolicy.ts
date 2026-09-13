import crypto from "node:crypto";
import { verifyTypedData } from "ethers";
import { getDb } from "@/lib/db/index";
import { ApiError } from "@/lib/api/helpers";

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

function mapRowToSession(row: any): AgentSessionRecord {
  return {
    sessionId: row.id,
    grantor: row.grantor,
    agentId: "hermes-agentic-operator",
    agentAddress: row.agent_address,
    validatorContract: row.validator_contract,
    constraints: {
      maxSpendHbar: row.max_spend_hbar,
      maxFlowRateMonthlyUsd: row.max_flow_monthly_usd,
      allowedActions: JSON.parse(row.allowed_actions),
      durationHours: Math.max(1, Math.round((row.expires_at - row.created_at) / 3600000)),
    },
    spentHbar: row.spent_hbar,
    activeStreamsCount: row.active_streams,
    nonce: row.nonce,
    chainId: row.chain_id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    signature: row.signature,
    signatureType: "EIP712",
    status: row.status,
  };
}

export function getActiveSession(grantorAddress?: string): AgentSessionRecord | null {
  if (!grantorAddress) return null;
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM agent_sessions
       WHERE grantor = ? AND status = 'ACTIVE' AND expires_at > ?
       ORDER BY created_at DESC LIMIT 1`
    )
    .get(grantorAddress.toLowerCase(), Date.now()) as any;

  return row ? mapRowToSession(row) : null;
}

export function getSessionById(sessionId: string): AgentSessionRecord | null {
  const db = getDb();
  const row = db
    .prepare("SELECT * FROM agent_sessions WHERE id = ?")
    .get(sessionId) as any;
  return row ? mapRowToSession(row) : null;
}

export function createSessionGrant(
  grantor: string,
  signature: string,
  customConstraints?: Partial<SessionPolicyConstraints>,
  nonce: number = Date.now(),
  chainId: number = DEFAULT_CHAIN_ID
): AgentSessionRecord {
  const db = getDb();
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

  const validUntilSec = Math.floor((Date.now() + constraints.durationHours * 3600000) / 1000);

  // 1. Strict EIP-712 Verification
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

  let recovered: string;
  try {
    recovered = verifyTypedData(domain, SESSION_KEY_EIP712_TYPES, typedValue, signature);
  } catch (err: any) {
    throw new ApiError(`Invalid EIP-712 session signature: ${err.message || "recovery failed"}`, 400);
  }

  if (recovered.toLowerCase() !== expectedSigner) {
    throw new ApiError("Session signature recovered address does not match grantor address", 401);
  }

  // 2. Prevent replay across policies (UNIQUE constraint check)
  const existing = db
    .prepare("SELECT id FROM agent_sessions WHERE grantor = ? AND nonce = ?")
    .get(expectedSigner, nonce);
  if (existing) {
    throw new ApiError("Session policy nonce already used. Please increment policy nonce.", 409);
  }

  // 3. Persist to Database
  const sessionId = `session_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
  const now = Date.now();
  const expiresAt = now + constraints.durationHours * 3600000;

  db.prepare(
    `INSERT INTO agent_sessions (
       id, grantor, agent_address, validator_contract, max_spend_hbar,
       max_flow_monthly_usd, allowed_actions, chain_id, nonce, expires_at,
       signature, signature_type, spent_hbar, active_streams, status, created_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EIP712', 0, 0, 'ACTIVE', ?)`
  ).run(
    sessionId,
    expectedSigner,
    HERMES_AGENT_ADDRESS,
    VALIDATOR_CONTRACT_ADDRESS,
    constraints.maxSpendHbar,
    constraints.maxFlowRateMonthlyUsd,
    JSON.stringify(constraints.allowedActions),
    chainId,
    nonce,
    expiresAt,
    signature,
    now
  );

  return getSessionById(sessionId)!;
}

export function validateAndSpendSession(
  sessionId: string,
  action: string,
  spendHbar: number = 0,
  flowRateMonthly: number = 0,
  requestNonce: string = crypto.randomUUID()
): PolicyValidationResult {
  const db = getDb();

  return db.transaction(() => {
    const row = db
      .prepare("SELECT * FROM agent_sessions WHERE id = ?")
      .get(sessionId) as any;

    if (!row) {
      return {
        allowed: false,
        reason: "Session key record not found.",
        remainingHbar: 0,
        session: null,
      };
    }

    const session = mapRowToSession(row);

    if (session.status !== "ACTIVE") {
      return {
        allowed: false,
        reason: `Session key is ${session.status}. Re-authorization required.`,
        remainingHbar: 0,
        session,
      };
    }

    if (Date.now() > session.expiresAt) {
      db.prepare("UPDATE agent_sessions SET status = 'EXPIRED' WHERE id = ?").run(sessionId);
      session.status = "EXPIRED";
      return {
        allowed: false,
        reason: "Session key has expired. Re-authorization required.",
        remainingHbar: 0,
        session,
      };
    }

    // 1. Action allowlist check
    if (!session.constraints.allowedActions.includes(action)) {
      return {
        allowed: false,
        reason: `Cryptographic Policy Violation: Action '${action}' is not in delegated allowlist.`,
        remainingHbar: Math.max(0, session.constraints.maxSpendHbar - session.spentHbar),
        session,
      };
    }

    // 2. Spend allowance check
    const remaining = session.constraints.maxSpendHbar - session.spentHbar;
    if (spendHbar > 0 && spendHbar > remaining) {
      return {
        allowed: false,
        reason: `Budget Cap Exceeded: Requested ${spendHbar} HBAR exceeds remaining allowance (${remaining.toFixed(2)} HBAR).`,
        remainingHbar: remaining,
        session,
      };
    }

    // 3. Flow rate ceiling check
    if (
      flowRateMonthly > 0 &&
      flowRateMonthly > session.constraints.maxFlowRateMonthlyUsd
    ) {
      return {
        allowed: false,
        reason: `Yield Ceiling Violation: Requested monthly stream of $${flowRateMonthly} exceeds permitted maximum of $${session.constraints.maxFlowRateMonthlyUsd}.`,
        remainingHbar: remaining,
        session,
      };
    }

    // 4. Request nonce replay prevention
    const nonceRow = db
      .prepare("SELECT nonce FROM agent_nonces WHERE session_id = ? AND nonce = ?")
      .get(sessionId, requestNonce);
    if (nonceRow) {
      return {
        allowed: false,
        reason: "Request nonce already used. Replay detected and rejected.",
        remainingHbar: remaining,
        session,
      };
    }

    // 5. Commit atomic spend and request nonce
    db.prepare("INSERT INTO agent_nonces (session_id, nonce, used_at) VALUES (?, ?, ?)")
      .run(sessionId, requestNonce, Date.now());

    if (spendHbar > 0) {
      db.prepare(
        "UPDATE agent_sessions SET spent_hbar = spent_hbar + ? WHERE id = ?"
      ).run(spendHbar, sessionId);

      db.prepare(
        "INSERT INTO agent_spend_log (session_id, action, spend_hbar, timestamp) VALUES (?, ?, ?, ?)"
      ).run(sessionId, action, spendHbar, Date.now());
    }

    const updatedRow = db
      .prepare("SELECT * FROM agent_sessions WHERE id = ?")
      .get(sessionId) as any;
    const updatedSession = mapRowToSession(updatedRow);

    return {
      allowed: true,
      remainingHbar: Math.max(0, updatedSession.constraints.maxSpendHbar - updatedSession.spentHbar),
      session: updatedSession,
    };
  })();
}

export function revokeSession(sessionId: string): void {
  const db = getDb();
  db.prepare("UPDATE agent_sessions SET status = 'REVOKED' WHERE id = ?").run(sessionId);
}
