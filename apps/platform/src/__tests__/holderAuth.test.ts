import { describe, it, expect, beforeAll } from "vitest";
import { POST as registerHolderPost } from "@/app/api/tokens/[tokenId]/holders/route";
import { POST as requestTokenPost } from "@/app/api/tokens/[tokenId]/requests/route";
import { POST as allowancePost } from "@/app/api/tokens/[tokenId]/holders/[accountId]/allowance/route";
import { POST as worldidVerifyPost } from "@/app/api/tokens/[tokenId]/holders/[accountId]/worldid-verify/route";
import { POST as worldidRetryPost } from "@/app/api/tokens/[tokenId]/holders/[accountId]/worldid-retry/route";
import { createAuthSession } from "@/lib/db/repo";

describe("Holder-Scoped Mutation Route Authorization", () => {
  const investorA = "0xa111111111111111111111111111111111111111";
  const investorB = "0xb222222222222222222222222222222222222222";
  const operatorAddr = "0x9999999999999999999999999999999999999999";

  let sessionInvestorA: string;
  let sessionOperator: string;
  const testTokenId = "0.0.4491823";

  beforeAll(() => {
    sessionInvestorA = createAuthSession({
      address: investorA,
      role: "investor",
      expiresAt: Date.now() + 3600000,
    });

    sessionOperator = createAuthSession({
      address: operatorAddr,
      role: "operator",
      expiresAt: Date.now() + 3600000,
    });
  });

  function makeRequest(body: any, sessionId?: string): Request {
    const headers: Record<string, string> = {
      "content-type": "application/json",
    };
    if (sessionId) {
      headers["cookie"] = `prism8_session=${sessionId}`;
    }
    return new Request("http://localhost:3000", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  }

  describe("POST /api/tokens/[tokenId]/holders", () => {
    it("rejects unauthenticated caller with 401", async () => {
      const req = makeRequest({ accountId: investorA });
      const res = await registerHolderPost(req, { params: Promise.resolve({ tokenId: testTokenId }) });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toContain("Authentication required");
    });

    it("rejects investor registering another account with 403", async () => {
      const evmTokenId = "0x71C8401E25687352f20D235F8d7fD1A392cf99a8";
      const req = makeRequest({ accountId: investorB }, sessionInvestorA);
      const res = await registerHolderPost(req, { params: Promise.resolve({ tokenId: evmTokenId }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Cannot act on behalf of another account");
    });

    it("allows investor to register own account for EVM token", async () => {
      const evmTokenId = "0x71C8401E25687352f20D235F8d7fD1A392cf99a8";
      const req = makeRequest({ accountId: investorA }, sessionInvestorA);
      const res = await registerHolderPost(req, { params: Promise.resolve({ tokenId: evmTokenId }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.holder?.accountId.toLowerCase()).toBe(investorA.toLowerCase());
    });

    it("allows operator to register any account", async () => {
      const target = "0.0.987654";
      const req = makeRequest({ accountId: target }, sessionOperator);
      const res = await registerHolderPost(req, { params: Promise.resolve({ tokenId: testTokenId }) });
      expect(res.status).toBe(201);
      const data = await res.json();
      expect(data.holder?.accountId).toBe(target);
    });
  });

  describe("POST /api/tokens/[tokenId]/requests", () => {
    it("rejects unauthenticated request creation with 401", async () => {
      const req = makeRequest({ accountId: investorA });
      const res = await requestTokenPost(req, { params: Promise.resolve({ tokenId: testTokenId }) });
      expect(res.status).toBe(401);
    });

    it("rejects investor requesting for another account with 403", async () => {
      const req = makeRequest({ accountId: investorB }, sessionInvestorA);
      const res = await requestTokenPost(req, { params: Promise.resolve({ tokenId: testTokenId }) });
      expect(res.status).toBe(403);
      const data = await res.json();
      expect(data.error).toContain("Cannot act on behalf of another account");
    });
  });

  describe("POST /api/tokens/[tokenId]/holders/[accountId]/allowance", () => {
    it("rejects unauthenticated approval with 401", async () => {
      const req = makeRequest({ txId: "0.0.123@123.456", amount: 100 });
      const res = await allowancePost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorA }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects investor acting on another account's allowance with 403", async () => {
      const req = makeRequest({ txId: "0.0.123@123.456", amount: 100 }, sessionInvestorA);
      const res = await allowancePost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorB }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/tokens/[tokenId]/holders/[accountId]/worldid-verify", () => {
    it("rejects unauthenticated verification with 401", async () => {
      const req = makeRequest({ check: "selfie", result: {} });
      const res = await worldidVerifyPost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorA }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects investor submitting verification for another account with 403", async () => {
      const req = makeRequest({ check: "selfie", result: {} }, sessionInvestorA);
      const res = await worldidVerifyPost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorB }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe("POST /api/tokens/[tokenId]/holders/[accountId]/worldid-retry", () => {
    it("rejects unauthenticated retry with 401", async () => {
      const req = makeRequest({ verificationId: 1 });
      const res = await worldidRetryPost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorA }),
      });
      expect(res.status).toBe(401);
    });

    it("rejects investor retrying another account's proof with 403", async () => {
      const req = makeRequest({ verificationId: 1 }, sessionInvestorA);
      const res = await worldidRetryPost(req, {
        params: Promise.resolve({ tokenId: testTokenId, accountId: investorB }),
      });
      expect(res.status).toBe(403);
    });
  });
});
