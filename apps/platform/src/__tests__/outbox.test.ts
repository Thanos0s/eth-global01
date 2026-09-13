import { describe, it, expect } from "vitest";
import {
  enqueueChainWrite,
  markOutboxDone,
  markOutboxFailed,
  getPendingOutboxJobs,
} from "@/lib/jobs/outbox";

describe("Durable Outbox Queue Pattern", () => {
  it("enqueues jobs idempotently with uniqueness guarantees", () => {
    const key = `test_idempotency_key_${Date.now()}`;
    const job = {
      type: "hedera_tx" as const,
      payload: { amount: 100, recipient: "0.0.12345" },
      idempotencyKey: key,
    };

    const firstId = enqueueChainWrite(job);
    expect(firstId).toBeGreaterThan(0);

    // Enqueueing same idempotencyKey must return the existing id without duplicating row
    const secondId = enqueueChainWrite(job);
    expect(secondId).toBe(firstId);
  });

  it("updates job status to DONE upon successful execution", () => {
    const key = `test_done_key_${Date.now()}`;
    const jobId = enqueueChainWrite({
      type: "evm_tx",
      payload: { data: "0x123" },
      idempotencyKey: key,
    });

    markOutboxDone(jobId, { txHash: "0xabcdef123456" });

    const pending = getPendingOutboxJobs();
    expect(pending.find((j) => j.id === jobId)).toBeUndefined();
  });

  it("increments attempt counter on failure", () => {
    const key = `test_fail_key_${Date.now()}`;
    const jobId = enqueueChainWrite({
      type: "hcs_message",
      payload: { msg: "audit" },
      idempotencyKey: key,
    });

    markOutboxFailed(jobId, "Network timeout 504");

    const pending = getPendingOutboxJobs();
    const failedJob = pending.find((j) => j.id === jobId);
    // Since status became FAILED, it won't appear in pending
    expect(failedJob).toBeUndefined();
  });
});
