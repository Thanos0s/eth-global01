import { describe, it, expect, beforeAll } from "vitest";
import { newDb } from "pg-mem";
import { PostgresAdapter } from "@/lib/db/postgresAdapter";

describe("Production PostgreSQL Database Layer Integration", () => {
  let memDb: any;
  let pool: any;
  let adapter: PostgresAdapter;

  beforeAll(async () => {
    // Spin up ephemeral PostgreSQL instance with pg-mem
    memDb = newDb({ noAstCoverageCheck: true });
    const pg = memDb.adapters.createPg();
    pool = new pg.Pool();

    adapter = new PostgresAdapter(pool);
    // Execute transactional migrations
    await adapter.init();
  });

  it("1. Initializes and verifies transactional migrations and healthy PostgreSQL status", async () => {
    const health = await adapter.getHealth();
    expect(health.dialect).toBe("postgres");
    expect(health.status).toBe("ok");
    expect(health.migrationStatus).toBe("applied");
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("2. Proves persistence survives across separate repository instances", async () => {
    const testTokenId = "0.0.9999888";
    const inserted = await adapter.insertToken({
      id: testTokenId,
      name: "Persistent Commercial Real Estate",
      symbol: "PCRE",
      tokenType: "FUNGIBLE",
      decimals: 2,
      initialSupply: 500000,
      supplyType: "FINITE",
      maxSupply: 1000000,
      treasuryAccountId: "0.0.12345",
      assetCategory: "real-estate",
      memo: "Austin Commercial Asset",
      compliance: {
        kycRequired: true,
        freezeDefault: false,
        wipeEnabled: true,
        pauseEnabled: true,
        worldIdRequired: true,
        worldIdSelfieCheck: true,
        livenessEnabled: true,
        livenessPeriodSeconds: 86400,
      },
      customFee: null,
      keys: {
        admin: true,
        kyc: true,
        freeze: true,
        wipe: true,
        pause: true,
        supply: true,
        feeSchedule: false,
      },
      createTxId: "0.0.12345-1234567890",
    });

    expect(inserted.id).toBe(testTokenId);

    // Create a holder and event
    await adapter.ensureHolder(testTokenId, "0.0.54321", "0x1111111111111111111111111111111111111111");
    await adapter.updateHolder(testTokenId, "0.0.54321", {
      associated: true,
      kycGranted: true,
      status: "WHITELISTED",
    });

    await adapter.insertEvent({
      tokenId: testTokenId,
      type: "KYC_GRANT",
      detail: { accountId: "0.0.54321" },
    });

    // Create a FRESH repository instance connected to the same pool
    const freshAdapter = new PostgresAdapter(pool);
    const retrievedToken = await freshAdapter.getToken(testTokenId);
    expect(retrievedToken).not.toBeNull();
    expect(retrievedToken?.name).toBe("Persistent Commercial Real Estate");
    expect(retrievedToken?.compliance.kycRequired).toBe(true);

    const retrievedHolders = await freshAdapter.listHolders(testTokenId);
    expect(retrievedHolders.length).toBe(1);
    expect(retrievedHolders[0].accountId).toBe("0.0.54321");
    expect(retrievedHolders[0].status).toBe("WHITELISTED");

    const retrievedEvents = await freshAdapter.listEvents(testTokenId);
    expect(retrievedEvents.length).toBe(1);
    expect(retrievedEvents[0].type).toBe("KYC_GRANT");
  });

  it("3. Concurrently consumes agent request nonce allowing EXACTLY ONE successful request", async () => {
    const concurrentNonce = "nonce-replay-test-" + Date.now();
    const expiresAt = Date.now() + 120_000;

    // Launch 10 simultaneous concurrent nonce consumption requests
    const concurrencyLevel = 10;
    const promises = Array.from({ length: concurrencyLevel }, () =>
      adapter.consumeAgentRequestNonce(concurrentNonce, expiresAt)
    );

    const results = await Promise.all(promises);

    const successfulConsumptions = results.filter((r) => r === true).length;
    const rejectedConsumptions = results.filter((r) => r === false).length;

    // Exactly one consumption must succeed
    expect(successfulConsumptions).toBe(1);
    // All 9 concurrent duplicates must be rejected
    expect(rejectedConsumptions).toBe(concurrencyLevel - 1);

    // Any subsequent attempt must also be rejected
    const followUpAttempt = await adapter.consumeAgentRequestNonce(concurrentNonce, expiresAt);
    expect(followUpAttempt).toBe(false);
  });

  it("4. Enforces durable outbox jobs with idempotency and transactional claiming", async () => {
    const idempotencyKey = "idemp-outbox-" + Date.now();

    // 1. Enqueue job
    const job1 = await adapter.enqueueOutboxJob({
      type: "TRANSFER_HTS",
      payload: { tokenId: "0.0.123", to: "0.0.456", amount: 100 },
      idempotencyKey,
    });
    expect(job1.id).toBeDefined();
    expect(job1.status).toBe("PENDING");

    // 2. Duplicate enqueue with same idempotency key returns same job
    const job2 = await adapter.enqueueOutboxJob({
      type: "TRANSFER_HTS",
      payload: { tokenId: "0.0.123", to: "0.0.456", amount: 100 },
      idempotencyKey,
    });
    expect(job2.id).toBe(job1.id);

    // 3. Claim pending outbox jobs
    const claimed = await adapter.claimPendingOutboxJobs(5);
    expect(claimed.some((j) => j.id === job1.id)).toBe(true);

    const claimedJob = claimed.find((j) => j.id === job1.id)!;
    expect(claimedJob.status).toBe("PROCESSING");
    expect(claimedJob.attempts).toBe(1);

    // 4. Complete outbox job
    await adapter.completeOutboxJob(job1.id, { txId: "0.0.123-completed" });
    const completedJob = await adapter.getOutboxJobByIdempotencyKey(idempotencyKey);
    expect(completedJob?.status).toBe("COMPLETED");
    expect(completedJob?.result).toEqual({ txId: "0.0.123-completed" });
  });

  it("5. Manages authentication sessions and single-use nonces", async () => {
    const testAddr = "0x2222222222222222222222222222222222222222";

    // Create and consume nonce
    const nonce = await adapter.createAuthNonce(testAddr);
    expect(nonce).toBeDefined();

    const firstUse = await adapter.consumeAuthNonce(nonce, testAddr);
    expect(firstUse).toBe(true);

    const replayUse = await adapter.consumeAuthNonce(nonce, testAddr);
    expect(replayUse).toBe(false);

    // Session lifecycle
    const sessionId = await adapter.createAuthSession({
      address: testAddr,
      role: "operator",
      expiresAt: Date.now() + 3600000,
      ip: "127.0.0.1",
    });

    const session = await adapter.getAuthSession(sessionId);
    expect(session).not.toBeNull();
    expect(session?.address).toBe(testAddr.toLowerCase());
    expect(session?.role).toBe("operator");
    expect(session?.revoked).toBe(false);

    await adapter.revokeAuthSession(sessionId);
    const revoked = await adapter.getAuthSession(sessionId);
    expect(revoked?.revoked).toBe(true);
  });

  it("6. Executes atomic validateAndSpendAgentSession and manages session status in PostgreSQL", async () => {
    const grantor = "0x7777777777777777777777777777777777777777";
    const sessionId = "pg_session_" + Date.now();
    const nonce = 5555;

    await adapter.saveAgentSession({
      id: sessionId,
      grantor,
      agentAddress: "0x89205A3A3b2A69De6Dbf7f01ED13B2108B2c43e7",
      validatorContract: "0x7579C0de00000000000000000000000000007579",
      maxSpendHbar: 10.0,
      maxFlowMonthlyUsd: 1000,
      allowedActions: ["ORACLE_USPS_X402"],
      chainId: 84532,
      nonce,
      expiresAt: Date.now() + 3600000,
      signature: "0xpg_sig",
      signatureType: "EIP712",
      spentHbar: 0,
      activeStreams: 0,
      status: "ACTIVE",
      createdAt: Date.now(),
    });

    const active = await adapter.getActiveAgentSession(grantor);
    expect(active?.id).toBe(sessionId);

    const spendResult = await adapter.validateAndSpendAgentSession(
      sessionId,
      "ORACLE_USPS_X402",
      2.0,
      500,
      "nonce_pg_001"
    );
    expect(spendResult.allowed).toBe(true);
    expect(spendResult.remainingHbar).toBe(8.0);
    expect(spendResult.session?.spentHbar).toBe(2.0);

    const replayResult = await adapter.validateAndSpendAgentSession(
      sessionId,
      "ORACLE_USPS_X402",
      1.0,
      500,
      "nonce_pg_001"
    );
    expect(replayResult.allowed).toBe(false);
    expect(replayResult.reason).toContain("Replay detected");

    await adapter.updateAgentSessionStatus(sessionId, "REVOKED");
    const revoked = await adapter.getAgentSession(sessionId);
    expect(revoked?.status).toBe("REVOKED");
  });
});
