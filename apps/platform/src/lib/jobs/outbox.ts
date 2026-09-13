import {
  enqueueOutboxJob,
  completeOutboxJob,
  failOutboxJob,
  claimPendingOutboxJobs,
} from "@/lib/db/repo";
import type { OutboxJobRecord } from "@/lib/db/types";

export interface OutboxJob {
  type: "hedera_tx" | "evm_tx" | "hcs_message" | "superfluid_cfa";
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export type OutboxRow = OutboxJobRecord;

export async function enqueueChainWrite(job: OutboxJob): Promise<number> {
  const record = await enqueueOutboxJob({
    type: job.type,
    payload: job.payload,
    idempotencyKey: job.idempotencyKey,
  });
  return record.id;
}

export async function markOutboxDone(id: number, result: Record<string, unknown>): Promise<void> {
  return completeOutboxJob(id, result);
}

export async function markOutboxFailed(id: number, errorMessage: string): Promise<void> {
  return failOutboxJob(id, errorMessage, 1);
}

export async function getPendingOutboxJobs(limit = 20): Promise<OutboxRow[]> {
  return claimPendingOutboxJobs(limit);
}
