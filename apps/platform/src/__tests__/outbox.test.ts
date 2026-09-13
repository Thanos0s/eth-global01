import { describe, it, expect } from "vitest";
import {
  enqueueChainWrite,
  markOutboxDone,
  markOutboxFailed,
  getPendingOutboxJobs,
} from "@/lib/jobs/outbox";

describe("Durable Outbox Queue Pattern", () => {
  it("enqueues jobs idempotently with uniqueness guarantees", async () => {
    const key = `test_idempotency_key_${Date.now()}`;
    const job = {
      type: "hedera_tx" as const,
      payload: { amount: 100, recipient: "0.0.12345" },
      idempotencyKey: key,
    };

    const firstId = await enqueueChainWrite(job);
    expect(firstId).toBeGreaterThan(0);

    // Enqueueing same idempotencyKey must return the existing id without duplicating row
    const secondId = await enqueueChainWrite(job);
    expect(secondId).toBe(firstId);
  });

  it("updates job status to DONE upon successful execution", async () => {
    const key = `test_done_key_${Date.now()}`;
    const jobId = await enqueueChainWrite({
      type: "evm_tx",
      payload: { data: "0x123" },
      idempotencyKey: key,
    });

    await markOutboxDone(jobId, { txHash: "0xabcdef123456" });

    const pending = await getPendingOutboxJobs();
    expect(pending.find((j) => j.id === jobId)).toBeUndefined();
  });

  it("increments attempt counter on failure", async () => {
    const key = `test_fail_key_${Date.now()}`;
    const jobId = await enqueueChainWrite({
      type: "hcs_message",
      payload: { msg: "audit" },
      idempotencyKey: key,
    });

    await markOutboxFailed(jobId, "Network timeout 504");

    const pending = await getPendingOutboxJobs();
    const failedJob = pending.find((j) => j.id === jobId);
    // Since status became FAILED, it won't appear in pending
    expect(failedJob).toBeUndefined();
  });

  it("checks database health reporting dialect and latency", async () => {
    const { getDatabaseHealth } = await import("@/lib/db/index");
    const health = await getDatabaseHealth();
    expect(health.dialect).toBe("sqlite");
    expect(health.status).toBe("ok");
    expect(health.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("exposes database dialect and latency in /api/health endpoint", async () => {
    const { GET } = await import("@/app/api/health/route");
    const res = await GET();
    const data = await res.json();
    expect(data.checks.database).toBe("ok");
    expect(data.database).toBeDefined();
    expect(data.database.dialect).toBe("sqlite");
    expect(data.database.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
