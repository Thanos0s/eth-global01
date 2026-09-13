import { describe, it, expect, beforeAll } from "vitest";
import {
  validateAndSpendSession,
  revokeSession,
  getActiveSession,
} from "@/lib/hermes/sessionPolicy";
import { saveAgentSession } from "@/lib/db/repo";

describe("Persistent EIP-712 Session Policy Engine", () => {
  const testGrantor = "0x5555555555555555555555555555555555555555";
  const testSessionId = `session_test_${Date.now()}`;
  const testNonce = Date.now();

  beforeAll(async () => {
    await saveAgentSession({
      id: testSessionId,
      grantor: testGrantor.toLowerCase(),
      agentAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      validatorContract: "0x7579C0de00000000000000000000000000007579",
      maxSpendHbar: 5.0,
      maxFlowMonthlyUsd: 5000,
      allowedActions: ["ORACLE_USPS_X402", "HCS_CONSENSUS_AUDIT"],
      chainId: 84532,
      nonce: testNonce,
      expiresAt: Date.now() + 3600000,
      signature: "0xmock_signature",
      signatureType: "EIP712",
      spentHbar: 0,
      activeStreams: 0,
      status: "ACTIVE",
      createdAt: Date.now(),
    });
  });

  it("retrieves the active session from database", async () => {
    const session = await getActiveSession(testGrantor);
    expect(session).not.toBeNull();
    expect(session?.sessionId).toBe(testSessionId);
    expect(session?.constraints.maxSpendHbar).toBe(5.0);
  });

  it("allows execution and deducts budget atomically within limits", async () => {
    const result = await validateAndSpendSession(
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

  it("blocks actions not in the delegated allowlist", async () => {
    const result = await validateAndSpendSession(
      testSessionId,
      "UNAUTHORIZED_MALICIOUS_DRAIN",
      0.1,
      0,
      "request_nonce_002"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in delegated allowlist");
  });

  it("prevents request nonce replay attacks", async () => {
    const result = await validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      0.5,
      3800,
      "request_nonce_001"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Replay detected");
  });

  it("rejects execution when spend exceeds remaining budget cap", async () => {
    const result = await validateAndSpendSession(
      testSessionId,
      "ORACLE_USPS_X402",
      10.0,
      3800,
      "request_nonce_003"
    );

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Budget Cap Exceeded");
  });

  it("rejects execution immediately if session is revoked", async () => {
    await revokeSession(testSessionId);

    const result = await validateAndSpendSession(
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
