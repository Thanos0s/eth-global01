import { describe, it, expect, beforeEach } from "vitest";
import {
  createAuthNonce,
  consumeAuthNonce,
  createAuthSession,
  getAuthSession,
  revokeAuthSession,
} from "@/lib/db/repo";
import { resolveAuthContext } from "@/lib/auth/middleware";
import { getDb } from "@/lib/db/index";

describe("Authentication Nonce Lifecycle", () => {
  const testAddress = "0x1111111111111111111111111111111111111111";

  it("issues a nonce and permits single consumption", async () => {
    const nonce = await createAuthNonce(testAddress);
    expect(nonce).toBeDefined();

    // First consumption must succeed
    const firstUse = await consumeAuthNonce(nonce, testAddress);
    expect(firstUse).toBe(true);

    // Immediate replay must fail
    const replayUse = await consumeAuthNonce(nonce, testAddress);
    expect(replayUse).toBe(false);
  });

  it("rejects nonce consumption for a mismatched address", async () => {
    const nonce = await createAuthNonce(testAddress);
    const wrongAddress = "0x2222222222222222222222222222222222222222";

    const consumed = await consumeAuthNonce(nonce, wrongAddress);
    expect(consumed).toBe(false);
  });

  it("rejects expired nonces", async () => {
    const nonce = await createAuthNonce(testAddress);
    // Artificially expire the nonce in SQLite
    getDb()
      .prepare("UPDATE auth_nonces SET expires_at = ? WHERE nonce = ?")
      .run(Date.now() - 1000, nonce);

    const consumed = await consumeAuthNonce(nonce, testAddress);
    expect(consumed).toBe(false);
  });
});

describe("Authentication Session Lifecycle & Middleware", () => {
  const investorAddress = "0x3333333333333333333333333333333333333333";

  it("creates an active session and resolves it correctly", async () => {
    const sessionId = await createAuthSession({
      address: investorAddress,
      role: "investor",
      expiresAt: Date.now() + 3600000,
    });

    const session = await getAuthSession(sessionId);
    expect(session).toBeDefined();
    expect(session?.role).toBe("investor");
    expect(session?.revoked).toBe(false);

    const mockReq = {
      cookies: {
        get: (name: string) => (name === "prism8_session" ? { value: sessionId } : undefined),
      },
      headers: {
        get: () => null,
      },
    } as any;

    const ctx = await resolveAuthContext(mockReq);
    expect(ctx).not.toBeNull();
    expect(ctx?.role).toBe("investor");
    expect(ctx?.address).toBe(investorAddress.toLowerCase());
  });

  it("returns null when session is revoked", async () => {
    const sessionId = await createAuthSession({
      address: investorAddress,
      role: "investor",
      expiresAt: Date.now() + 3600000,
    });

    await revokeAuthSession(sessionId);

    const mockReq = {
      cookies: {
        get: (name: string) => (name === "prism8_session" ? { value: sessionId } : undefined),
      },
      headers: {
        get: () => null,
      },
    } as any;

    const ctx = await resolveAuthContext(mockReq);
    expect(ctx).toBeNull();
  });

  it("returns null when session has expired", async () => {
    const sessionId = await createAuthSession({
      address: investorAddress,
      role: "investor",
      expiresAt: Date.now() - 5000,
    });

    const mockReq = {
      cookies: {
        get: (name: string) => (name === "prism8_session" ? { value: sessionId } : undefined),
      },
      headers: {
        get: () => null,
      },
    } as any;

    const ctx = await resolveAuthContext(mockReq);
    expect(ctx).toBeNull();
  });
});
