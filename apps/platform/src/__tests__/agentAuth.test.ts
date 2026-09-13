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

  it("rejects request when secret is missing or mismatched", async () => {
    const req = new Request("http://localhost:3000/api/internal", {
      headers: { "x-tokenization-agent-secret": "wrong-secret" },
    });
    await expect(requireAgentRequest(req)).rejects.toThrowError(ApiError);
    try {
      await requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("secret mismatch");
    }
  });

  it("rejects request when required headers (timestamp, nonce, hmac) are missing", async () => {
    const reqNoTs = createSignedRequest({ omitTimestamp: true });
    await expect(requireAgentRequest(reqNoTs)).rejects.toThrowError(ApiError);
    try {
      await requireAgentRequest(reqNoTs);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("Missing required agent HMAC, timestamp, or nonce headers");
    }

    const reqNoNonce = createSignedRequest({ omitNonce: true });
    await expect(requireAgentRequest(reqNoNonce)).rejects.toThrowError(ApiError);

    const reqNoHmac = createSignedRequest({ omitHmac: true });
    await expect(requireAgentRequest(reqNoHmac)).rejects.toThrowError(ApiError);
  });

  it("rejects request with expired timestamp (>120s)", async () => {
    const expiredTs = Date.now() - 130_000;
    const req = createSignedRequest({ timestamp: expiredTs });
    await expect(requireAgentRequest(req)).rejects.toThrowError(ApiError);
    try {
      await requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("outside allowed ±120s window");
    }
  });

  it("rejects request with invalid HMAC signature", async () => {
    const req = createSignedRequest({ tamperHmac: true });
    await expect(requireAgentRequest(req)).rejects.toThrowError(ApiError);
    try {
      await requireAgentRequest(req);
    } catch (e: any) {
      expect(e.status).toBe(401);
      expect(e.message).toContain("HMAC verification failed");
    }
  });

  it("accepts valid signed request and consumes nonce", async () => {
    const nonce = "valid_nonce_12345";
    const req = createSignedRequest({ nonce });
    await expect(requireAgentRequest(req)).resolves.not.toThrow();

    // Verify nonce exists in database
    const row = getDb()
      .prepare("SELECT nonce FROM agent_request_nonces WHERE nonce = ?")
      .get(nonce);
    expect(row).toBeDefined();
  });

  it("rejects replay of the same nonce with 409", async () => {
    const nonce = "replay_nonce_test_001";
    const req1 = createSignedRequest({ nonce });
    const req2 = createSignedRequest({ nonce });

    // First request must succeed
    await expect(requireAgentRequest(req1)).resolves.not.toThrow();

    // Second request with same nonce must be rejected with 409
    await expect(requireAgentRequest(req2)).rejects.toThrowError(ApiError);
    try {
      await requireAgentRequest(req2);
    } catch (e: any) {
      expect(e.status).toBe(409);
      expect(e.message).toContain("replay rejected");
    }
  });

  it("purges expired nonces automatically", async () => {
    const db = getDb();
    const now = Date.now();
    // Insert an expired nonce and an active nonce directly
    db.prepare("INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?)")
      .run("expired_nonce_1", now - 1000, now - 60000);
    db.prepare("INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?)")
      .run("active_nonce_1", now + 60000, now);

    const purged = await purgeExpiredAgentRequestNonces(now);
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
