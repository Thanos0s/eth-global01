import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { createHmac } from "node:crypto";
import { requireAgentRequest, ApiError } from "@/lib/api/helpers";
import { consumeAgentRequestNonce, purgeExpiredAgentRequestNonces } from "@/lib/db/repo";
import { getDb } from "@/lib/db/index";

describe("Durable Agent Request Nonce & HMAC Replay Prevention", () => {
  const secret = "test-agent-secret-key-1234567890abcdef";

  beforeAll(() => {
    process.env.TOKENIZATION_AGENT_SECRET = secret;
  });

  beforeEach(() => {
    getDb().prepare("DELETE FROM agent_request_nonces").run();
  });

  function createSignedRequest(options: {
    secretHeader?: string;
    timestamp?: number;
    nonce?: string;
    hmac?: string;
    tamperHmac?: boolean;
    omitTimestamp?: boolean;
    omitNonce?: boolean;
    omitHmac?: boolean;
  }): Request {
    const sec = options.secretHeader ?? secret;
    const ts = options.timestamp ?? Date.now();
    const nonce = options.nonce ?? `nonce_${Math.random()}_${Date.now()}`;
    const calculatedHmac = createHmac("sha256", secret)
      .update(`${sec}:${ts}:${nonce}`)
      .digest("hex");

    const headers: Record<string, string> = {};
    if (options.secretHeader !== undefined || !headers["x-tokenization-agent-secret"]) {
      headers["x-tokenization-agent-secret"] = sec;
    }
    if (!options.omitTimestamp) {
      headers["x-agent-timestamp"] = String(ts);
    }
    if (!options.omitNonce) {
      headers["x-agent-nonce"] = nonce;
    }
    if (!options.omitHmac) {
      headers["x-agent-hmac"] = options.tamperHmac
        ? "0000000000000000000000000000000000000000000000000000000000000000"
        : (options.hmac ?? calculatedHmac);
    }

    return new Request("http://localhost:3000/api/internal", {
      method: "POST",
      headers,
    });
  }

  it("rejects request when secret is missing or mismatched", () => {
    const req = new Request("http://localhost:3000/api/internal", {
      headers: { "x-tokenization-agent-secret": "wrong-secret" },
    });
    expect(() => requireAgentRequest(req)).toThrowError(ApiError);
    try {
      requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("secret mismatch");
    }
  });

  it("rejects request when required headers (timestamp, nonce, hmac) are missing", () => {
    const reqNoTs = createSignedRequest({ omitTimestamp: true });
    expect(() => requireAgentRequest(reqNoTs)).toThrowError(ApiError);
    try {
      requireAgentRequest(reqNoTs);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("Missing required agent HMAC, timestamp, or nonce headers");
    }

    const reqNoNonce = createSignedRequest({ omitNonce: true });
    expect(() => requireAgentRequest(reqNoNonce)).toThrowError(ApiError);

    const reqNoHmac = createSignedRequest({ omitHmac: true });
    expect(() => requireAgentRequest(reqNoHmac)).toThrowError(ApiError);
  });

  it("rejects request with expired timestamp (>120s)", () => {
    const expiredTs = Date.now() - 130_000;
    const req = createSignedRequest({ timestamp: expiredTs });
    expect(() => requireAgentRequest(req)).toThrowError(ApiError);
    try {
      requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("outside allowed ±120s window");
    }
  });

  it("rejects request with invalid HMAC signature", () => {
    const req = createSignedRequest({ tamperHmac: true });
    expect(() => requireAgentRequest(req)).toThrowError(ApiError);
    try {
      requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("HMAC verification failed");
    }
  });

  it("accepts valid signed request and consumes nonce", () => {
    const nonce = "valid_nonce_12345";
    const req = createSignedRequest({ nonce });
    expect(() => requireAgentRequest(req)).not.toThrow();

    // Verify nonce exists in database
    const row = getDb()
      .prepare("SELECT nonce FROM agent_request_nonces WHERE nonce = ?")
      .get(nonce);
    expect(row).toBeDefined();
  });

  it("rejects replay of the same nonce with 409", () => {
    const nonce = "replay_nonce_test_001";
    const req1 = createSignedRequest({ nonce });
    const req2 = createSignedRequest({ nonce });

    // First request must succeed
    expect(() => requireAgentRequest(req1)).not.toThrow();

    // Second request with same nonce must be rejected with 409
    expect(() => requireAgentRequest(req2)).toThrowError(ApiError);
    try {
      requireAgentRequest(req2);
    } catch (e: any) {
      expect(e.status).toBe(409);
      expect(e.message).toContain("replay rejected");
    }
  });

  it("purges expired nonces automatically", () => {
    const db = getDb();
    const now = Date.now();
    // Insert an expired nonce and an active nonce directly
    db.prepare("INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?)")
      .run("expired_nonce_1", now - 1000, now - 60000);
    db.prepare("INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?)")
      .run("active_nonce_1", now + 60000, now);

    const purged = purgeExpiredAgentRequestNonces(now);
    expect(purged).toBe(1);

    const expiredRow = db
      .prepare("SELECT nonce FROM agent_request_nonces WHERE nonce = ?")
      .get("expired_nonce_1");
    expect(expiredRow).toBeUndefined();

    const activeRow = db
      .prepare("SELECT nonce FROM agent_request_nonces WHERE nonce = ?")
      .get("active_nonce_1");
    expect(activeRow).toBeDefined();
  });
});
