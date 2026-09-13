import { getDb } from "@/lib/db/index";

export interface OutboxJob {
  type: "hedera_tx" | "evm_tx" | "hcs_message" | "superfluid_cfa";
  payload: Record<string, unknown>;
  idempotencyKey: string;
}

export interface OutboxRow {
  id: number;
  type: string;
  payload: string;
  status: "PENDING" | "PROCESSING" | "DONE" | "FAILED";
  attempts: number;
  last_error: string | null;
  idempotency_key: string | null;
  result: string | null;
  created_at: number;
  updated_at: number;
}

export function enqueueChainWrite(job: OutboxJob): number {
  const db = getDb();
  const now = Date.now();

  const insert = db
    .prepare(
      `INSERT INTO outbox (type, payload, idempotency_key, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(idempotency_key) DO NOTHING`
    )
    .run(job.type, JSON.stringify(job.payload), job.idempotencyKey, now, now);

  if (insert.changes === 0) {
    const existing = db
      .prepare("SELECT id FROM outbox WHERE idempotency_key = ?")
      .get(job.idempotencyKey) as { id: number };
    return existing.id;
  }

  return Number(insert.lastInsertRowid);
}

export function markOutboxDone(id: number, result: Record<string, unknown>): void {
  const db = getDb();
  db.prepare(
    `UPDATE outbox
     SET status = 'DONE', result = ?, updated_at = ?
     WHERE id = ?`
  ).run(JSON.stringify(result), Date.now(), id);
}

export function markOutboxFailed(id: number, errorMessage: string): void {
  const db = getDb();
  db.prepare(
    `UPDATE outbox
     SET status = 'FAILED', last_error = ?, attempts = attempts + 1, updated_at = ?
     WHERE id = ?`
  ).run(errorMessage, Date.now(), id);
}

export function getPendingOutboxJobs(limit = 20): OutboxRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT * FROM outbox
       WHERE status = 'PENDING' AND attempts < 5
       ORDER BY created_at ASC
       LIMIT ?`
    )
    .all(limit) as OutboxRow[];
}
