import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  createInvoice,
  getInvoice,
  consumeInvoice,
  markInvoiceSettled,
  isTxAlreadyUsed,
  clearInvoiceStore,
  TIER_PRICING,
} from "../lib/x402/invoiceStore";
import {
  verifyHederaSettlement,
  formatTxIdForMirrorNode,
} from "../lib/x402/settlementVerifier";
import {
  handlePropertyOracleRequest,
  computeAddressHash,
} from "../lib/x402/oracleService";

// Mock HCS audit logging to allow offline deterministic testing of oracle flow
vi.mock("../lib/hedera/hcsAudit", () => ({
  logHcsAuditEvent: vi.fn(async (payload) => ({
    topicId: process.env.HEDERA_AUDIT_TOPIC_ID || "0.0.10522243",
    sequenceNumber: 42,
    consensusTimestamp: "2026-09-13T18:00:00.000Z",
    txId: payload.txId || "0.0.10521086@1789302966.922418976",
    hashscanUrl: `https://hashscan.io/testnet/topic/0.0.10522243`,
    event: payload.event,
  })),
  getOrCreateAuditTopic: vi.fn(async () => "0.0.10522243"),
}));

describe("x402 Hedera Agentic Payments & Settlement Verification", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.DEMO_MODE = "false";
    process.env.HEDERA_ORACLE_PAYEE_ID = "0.0.10521086";
    process.env.HEDERA_AUDIT_TOPIC_ID = "0.0.10522243";
    clearInvoiceStore();
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
  });

  describe("Invoice Store & Cryptographic Binding", () => {
    it("creates invoices with correct pricing tiers, payee, and TTL", () => {
      const standardInv = createInvoice("0xhash123", "STANDARD_DPV");
      expect(standardInv.invoiceId).toMatch(/^inv_\d+_[a-f0-9]+$/);
      expect(standardInv.amountTinybar).toBe(TIER_PRICING.STANDARD_DPV.tinybars);
      expect(standardInv.displayAmount).toBe("0.5 HBAR");
      expect(standardInv.payee).toBe("0.0.10521086");
      expect(standardInv.expiresAt).toBeGreaterThan(Date.now());
      expect(standardInv.status).toBe("PENDING");

      const premiumInv = createInvoice("0xhash456", "PREMIUM_DPV");
      expect(premiumInv.amountTinybar).toBe(TIER_PRICING.PREMIUM_DPV.tinybars);
      expect(premiumInv.displayAmount).toBe("1.0 HBAR");
    });

    it("prevents double consumption and transaction replay", () => {
      const inv = createInvoice("0xhash789", "STANDARD_DPV");
      expect(getInvoice(inv.invoiceId)).toBeDefined();

      // Settle invoice with tx
      const txId = "0.0.10521086@1789302966.922418976";
      markInvoiceSettled(inv.invoiceId, txId);
      expect(isTxAlreadyUsed(txId)).toBe(true);

      // Re-using the same tx must throw
      const inv2 = createInvoice("0xhash999", "STANDARD_DPV");
      expect(() => markInvoiceSettled(inv2.invoiceId, txId)).toThrow("already been consumed");

      // Consuming invoice twice must throw
      consumeInvoice(inv.invoiceId);
      expect(() => consumeInvoice(inv.invoiceId)).toThrow("already been consumed");
    });
  });

  describe("Mirror Node Formatting & Settlement Verification", () => {
    it("formats Hedera transaction ID to mirror node API slug", () => {
      const formatted = formatTxIdForMirrorNode("0.0.10521086@1789302966.922418976");
      expect(formatted).toBe("0.0.10521086-1789302966-922418976");
    });

    it("rejects malformed Hedera transaction IDs in production mode", async () => {
      const inv = createInvoice("0xhash", "STANDARD_DPV");
      const result = await verifyHederaSettlement("fake_tx_12345", inv);
      expect(result.verified).toBe(false);
      expect(result.error).toContain("Invalid Hedera transaction ID format");
    });

    it("rejects when mirror node returns 404 (transaction not found / unconfirmed)", async () => {
      const inv = createInvoice("0xhash", "STANDARD_DPV");
      const txId = "0.0.10521086@1789302966.922418976";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      } as Response);

      const result = await verifyHederaSettlement(txId, inv);
      expect(result.verified).toBe(false);
      expect(result.error).toContain("not found on Hedera Testnet Mirror Node");
    });

    it("rejects when transaction consensus result is not SUCCESS", async () => {
      const inv = createInvoice("0xhash", "STANDARD_DPV");
      const txId = "0.0.10521086@1789302966.922418976";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactions: [
            {
              result: "INSUFFICIENT_PAYER_BALANCE",
              transfers: [],
            },
          ],
        }),
      } as Response);

      const result = await verifyHederaSettlement(txId, inv);
      expect(result.verified).toBe(false);
      expect(result.error).toContain("INSUFFICIENT_PAYER_BALANCE");
    });

    it("rejects when payee transfer amount is less than invoice price", async () => {
      const inv = createInvoice("0xhash", "STANDARD_DPV"); // expects 50,000,000 tinybars
      const txId = "0.0.10521086@1789302966.922418976";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactions: [
            {
              result: "SUCCESS",
              transfers: [
                { account: inv.payee, amount: 10000 }, // Underpaid: only 10,000 tinybars
                { account: "0.0.10521086", amount: -10000 },
              ],
            },
          ],
        }),
      } as Response);

      const result = await verifyHederaSettlement(txId, inv);
      expect(result.verified).toBe(false);
      expect(result.error).toContain("Insufficient payment");
    });

    it("accepts and verifies valid Hedera Testnet settlement with exact/excess tinybars", async () => {
      const inv = createInvoice("0xhash", "STANDARD_DPV");
      const txId = "0.0.10521086@1789302966.922418976";

      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactions: [
            {
              result: "SUCCESS",
              consensus_timestamp: "1789302970.123456789",
              memo_base64: Buffer.from(`x402 USPS Oracle Settlement ${inv.invoiceId}`).toString("base64"),
              transfers: [
                { account: inv.payee, amount: 50000000 },
                { account: "0.0.10521086", amount: -50000000 },
              ],
            },
          ],
        }),
      } as Response);

      const result = await verifyHederaSettlement(txId, inv);
      expect(result.verified).toBe(true);
      expect(result.payerAccountId).toBe("0.0.10521086");
      expect(result.payeeAccountId).toBe(inv.payee);
      expect(result.amountTinybars).toBe("50000000");
      expect(result.facilitator).toBe("blocky402");
    });
  });

  describe("x402 Property Oracle Flow (handlePropertyOracleRequest)", () => {
    const validAddress = {
      street: "742 Evergreen Terrace",
      city: "Springfield",
      state: "OR",
      zip: "97477",
    };

    it("computes deterministic address hashes", () => {
      const h1 = computeAddressHash(validAddress);
      const h2 = computeAddressHash(validAddress);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^0x[a-f0-9]{64}$/);
    });

    it("returns HTTP 402 challenge on unpaid request with complete challenge metadata", async () => {
      const response = await handlePropertyOracleRequest(validAddress);
      expect(response.status).toBe(402);
      expect(response.x402).toBeDefined();
      expect(response.x402?.version).toBe("1.0");
      expect(response.x402?.network).toBe("hedera-testnet");
      expect(response.x402?.facilitator).toBe("blocky402");
      expect(response.x402?.payee).toBe("0.0.10521086");
      expect(response.x402?.amount).toBe("50000000");
      expect(response.x402?.displayAmount).toBe("0.5 HBAR");
      expect(response.x402?.invoiceId).toMatch(/^inv_/);
      expect(response.x402?.auditTopicId).toBe("0.0.10522243");
      expect(response.x402?.instructions).toContain("Submit 0.5 HBAR payment to payee");
    });

    it("returns HTTP 400 on missing address input", async () => {
      const response = await handlePropertyOracleRequest({
        street: "",
        city: "",
        state: "",
        zip: "",
      });
      expect(response.status).toBe(400);
      expect(response.error).toContain("Missing required address fields");
    });

    it("rejects payment proof missing X-Payment-Invoice header", async () => {
      const response = await handlePropertyOracleRequest(validAddress, {
        paymentTx: "0.0.10521086@1789302966.922418976",
      });
      expect(response.status).toBe(400);
      expect(response.error).toContain("Missing required 'X-Payment-Invoice'");
    });

    it("rejects non-existent invoice ID", async () => {
      const response = await handlePropertyOracleRequest(validAddress, {
        paymentTx: "0.0.10521086@1789302966.922418976",
        invoiceId: "inv_nonexistent",
      });
      expect(response.status).toBe(400);
      expect(response.error).toContain("was not found or has expired");
    });

    it("executes full verified flow and generates HCS audit receipt", async () => {
      // Step 1: Challenge
      const challengeRes = await handlePropertyOracleRequest(validAddress);
      expect(challengeRes.status).toBe(402);
      const invoiceId = challengeRes.x402!.invoiceId;
      const txId = "0.0.10521086@1789302966.922418976";

      // Mock Mirror Node HTTP response
      vi.spyOn(global, "fetch").mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          transactions: [
            {
              result: "SUCCESS",
              consensus_timestamp: "1789302970.123456789",
              memo_base64: Buffer.from(`x402 USPS Settlement ${invoiceId}`).toString("base64"),
              transfers: [
                { account: "0.0.10521086", amount: 50000000 },
                { account: "0.0.4491823", amount: -50000000 },
              ],
            },
          ],
        }),
      } as Response);

      // Step 2: Payment submission
      const fulfilledRes = await handlePropertyOracleRequest(validAddress, {
        paymentTx: txId,
        invoiceId: invoiceId,
      });

      expect(fulfilledRes.status).toBe(200);
      expect(fulfilledRes.data).toBeDefined();
      expect(fulfilledRes.data?.isValid).toBe(true);
      expect(fulfilledRes.data?.dpvConfirmation).toBe("Y");
      expect(fulfilledRes.data?.paymentProof.txId).toBe(txId);
      expect(fulfilledRes.data?.paymentProof.invoiceId).toBe(invoiceId);
      expect(fulfilledRes.data?.paymentProof.amount).toBe("0.5 HBAR");
      expect(fulfilledRes.data?.hcsAudit.topicId).toBe("0.0.10522243");
      expect(fulfilledRes.data?.hcsAudit.hashscanUrl).toContain("0.0.10522243");

      // Step 3: Replaying same request must fail
      const replayRes = await handlePropertyOracleRequest(validAddress, {
        paymentTx: txId,
        invoiceId: invoiceId,
      });
      expect(replayRes.status).toBe(400);
      expect(replayRes.error).toContain("already been consumed");
    });

    it("handles pre-settled invoice from facilitator without double-spend collision", async () => {
      const initial = await handlePropertyOracleRequest(validAddress);
      const invoiceId = initial.x402!.invoiceId;
      const txId = "0.0.10521086@1789302999.123456789";

      // Mark settled as if /api/x402/settle executed it
      markInvoiceSettled(invoiceId, txId);

      // Fulfilling with the same settled txId should succeed seamlessly
      const fulfilled = await handlePropertyOracleRequest(validAddress, {
        paymentTx: txId,
        invoiceId,
      });

      expect(fulfilled.status).toBe(200);
      expect(fulfilled.data?.paymentProof.txId).toBe(txId);
      expect(fulfilled.data?.dpvConfirmation).toBe("Y");
    });

    it("facilitates and settles EVM signature proof on Hedera Testnet when operator is configured", async () => {
      const initial = await handlePropertyOracleRequest(validAddress);
      const invoiceId = initial.x402!.invoiceId;
      const evmSig = "0x21f9ea865ecd00bc76f675ba5927a9194f9ea39e33fe9b26b1b3c7e2fc26dcd617dc0286bbb6d11d7cfbe59225247dd6d922a516595c80c1609410c370b6b4661b";

      const res = await handlePropertyOracleRequest(validAddress, {
        paymentTx: evmSig,
        invoiceId,
      });

      // The facilitator accepts the EVM authorization and settles on Hedera
      expect(res.status).toBe(200);
      expect(res.data?.isValid).toBe(true);
      expect(res.data?.dpvConfirmation).toBe("Y");
      expect(res.data?.paymentProof.txId).toMatch(/^0\.0\.\d+@\d+\.\d+$/);
    });
  });
});
