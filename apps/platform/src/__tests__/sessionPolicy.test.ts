import { describe, it, expect, beforeAll } from "vitest";
import { getDb } from "@/lib/db/index";
import {
  validateAndSpendSession,
  revokeSession,
  getActiveSession,
} from "@/lib/hermes/sessionPolicy";

describe("Persistent EIP-712 Session Policy Engine", () => {
  const testGrantor = "0x5555555555555555555555555555555555555555";
  const testSessionId = "session_test_persistent_001";

  beforeAll(() => {
    const db = getDb();
    db.prepare("DELETE FROM agent_nonces WHERE session_id = ?").run(testSessionId);
    db.prepare("DELETE FROM agent_spend_log WHERE session_id = ?").run(testSessionId);
    db.prepare("DELETE FROM agent_sessions WHERE id = ?").run(testSessionId);

    db.prepare(
      `INSERT OR REPLACE INTO agent_sessions (
         id, grantor, agent_address, validator_contract, max_spend_hbar,
         max_flow_monthly_usd, allowed_actions, chain_id, nonce, expires_at,
         signature, signature_type, spent_hbar, active_streams, status, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'EIP712', 0, 0, 'ACTIVE', ?)`
    ).run(
      testSessionId,
      testGrantor.toLowerCase(),
      "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      "0x7579C0de00000000000000000000000000007579",
      5.0,
      5000,
      JSON.stringify(["ORACLE_USPS_X402", "HCS_CONSENSUS_AUDIT"]),
      84532,
      9999,
      Date.now() + 3600000,
      "0xmock_signature",
      Date.now()
    );
  });

  it("retrieves the active session from database", () => {
    const session = getActiveSession(testGrantor);
    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe(testSessionId);
    expect(session?.constraints.maxSpendHbar).toBe(5.0);
  });

  it("allows execution and deducts budget atomically within limits", () => {
    const result = validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      0.5,
      3800,
      "request_nonce_001"
    );

    expect(result.allowed).toBe(true);
    expect(result.remainingHbar).toBe(4.5);
    expect(result.session?.spentHbar).toBe(0.5);
  });

  it("blocks actions not in the delegated allowlist", () => {
    const result = validateAndSpendSession(
      testSessionId,
      "UNAUTHORIZED_MALICIOUS_DRAIN",
      0.1,
      0,
      "request_nonce_002"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in delegated allowlist");
  });

  it("prevents request nonce replay attacks", () => {
    // Attempt to reuse request_nonce_001 from earlier test
    const result = validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      0.5,
      3800,
      "request_nonce_001"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Replay detected");
  });

  it("rejects execution when spend exceeds remaining budget cap", () => {
    // Requesting 10.0 HBAR when remaining budget is 4.5
    const result = validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      10.0,
      3800,
      "request_nonce_003"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Budget Cap Exceeded");
  });

  it("rejects execution immediately if session is revoked", () => {
    revokeSession(testSessionId);

    const result = validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      0.1,
      0,
      "request_nonce_004"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("REVOKED");
  });
});
