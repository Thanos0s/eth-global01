import type { Pool } from "pg";
import type {
  IDatabaseAdapter,
  DatabaseHealthInfo,
  InsertTokenParams,
  UpdateHolderPatch,
  InsertEventParams,
  UpsertTokenRequestParams,
  UpdateTokenRequestPatch,
  InsertWorldIdVerificationParams,
  UpdateWorldIdVerificationPatch,
  WorldIdCompletionResult,
  CreateAuthSessionParams,
  AuthSessionRecord,
  AgentSessionRecord,
  EnqueueOutboxParams,
  OutboxJobRecord,
  AuditLogRow,
} from "./types";
import type {
  TokenRecord,
  HolderRecord,
  EventRecord,
  TokenRequestRecord,
  WorldIdVerificationRecord,
  Blockchain,
  TokenNetwork,
  TokenType,
  SupplyType,
  AssetCategory,
  CustomFeeConfig,
  TokenRequestStatus,
  HermesTriggerStatus,
  HolderStatus,
  LivenessReclaimStatus,
  WorldIdCheckKind,
  WorldIdVerificationStatus,
} from "@/types";
import type { AuditEvent } from "../audit/logger";
import { tokenExplorerUrl } from "@/lib/chains";
import { randomUUID } from "node:crypto";
import { migratePostgres, POSTGRES_SCHEMA_SQL } from "./postgres";

export class PostgresAdapter implements IDatabaseAdapter {
  private pool: Pool;
  private migrated = false;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  getDialect(): "postgres" {
    return "postgres";
  }

  async init(): Promise<void> {
    if (!this.migrated) {
      await migratePostgres(this.pool);
      this.migrated = true;
    }
  }

  async getHealth(): Promise<DatabaseHealthInfo> {
    const start = Date.now();
    try {
      const res = await this.pool.query("SELECT 1 AS alive");
      const ok = res.rows.length > 0 && (res.rows[0].alive === 1 || res.rows[0].alive === "1");
      return {
        dialect: "postgres",
        status: ok ? "ok" : "degraded",
        migrationStatus: this.migrated ? "applied" : "pending",
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        dialect: "postgres",
        status: "degraded",
        migrationStatus: "pending",
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  // --- Tokens ---

  async insertToken(params: InsertTokenParams): Promise<TokenRecord> {
    await this.init();
    const query = `
      INSERT INTO tokens (
        id, blockchain, network, name, symbol, token_type, decimals, initial_supply, supply_type, max_supply,
        treasury_account_id, asset_category, memo,
        kyc_required, freeze_default, wipe_enabled, pause_enabled, world_id_required,
        world_id_selfie_check, world_id_minimum_age, world_id_nationality,
        liveness_enabled, liveness_period_seconds,
        custom_fee_enabled, custom_fee_config,
        has_admin_key, has_kyc_key, has_freeze_key, has_wipe_key, has_pause_key, has_supply_key, has_fee_schedule_key,
        create_tx_id
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
        $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21,
        $22, $23,
        $24, $25,
        $26, $27, $28, $29, $30, $31, $32,
        $33
      ) RETURNING *;
    `;
    const values = [
      params.id,
      params.blockchain ?? "HEDERA",
      params.network ?? "testnet",
      params.name,
      params.symbol,
      params.tokenType,
      params.decimals,
      String(params.initialSupply),
      params.supplyType,
      params.maxSupply != null ? String(params.maxSupply) : null,
      params.treasuryAccountId,
      params.assetCategory,
      params.memo ?? null,
      params.compliance.kycRequired,
      params.compliance.freezeDefault,
      params.compliance.wipeEnabled,
      params.compliance.pauseEnabled,
      params.compliance.worldIdRequired,
      params.compliance.worldIdSelfieCheck,
      params.compliance.worldIdMinimumAge ?? null,
      params.compliance.worldIdNationality ?? null,
      params.compliance.livenessEnabled,
      params.compliance.livenessPeriodSeconds ?? null,
      Boolean(params.customFee),
      params.customFee ? JSON.stringify(params.customFee) : null,
      params.keys.admin,
      params.keys.kyc,
      params.keys.freeze,
      params.keys.wipe,
      params.keys.pause,
      params.keys.supply,
      params.keys.feeSchedule,
      params.createTxId,
    ];
    const res = await this.pool.query(query, values);
    return this.mapToken(res.rows[0]);
  }

  async getToken(id: string): Promise<TokenRecord | null> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM tokens WHERE id = $1 LIMIT 1", [id]);
    return res.rows[0] ? this.mapToken(res.rows[0]) : null;
  }

  async listTokens(): Promise<TokenRecord[]> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM tokens ORDER BY created_at DESC");
    return res.rows.map((row) => this.mapToken(row));
  }

  async setTokenPaused(id: string, paused: boolean): Promise<TokenRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "UPDATE tokens SET paused = $1 WHERE id = $2 RETURNING *",
      [paused, id]
    );
    return res.rows[0] ? this.mapToken(res.rows[0]) : null;
  }

  // --- Holders ---

  async ensureHolder(tokenId: string, accountId: string, evmAddress?: string | null): Promise<HolderRecord> {
    await this.init();
    await this.pool.query(
      `INSERT INTO holders (token_id, account_id, evm_address, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())
       ON CONFLICT (token_id, account_id) DO NOTHING`,
      [tokenId, accountId, evmAddress ?? null]
    );
    const holder = await this.getHolder(tokenId, accountId);
    if (!holder) throw new Error("Failed to ensure holder row exists");
    return holder;
  }

  async getHolder(tokenId: string, accountId: string): Promise<HolderRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM holders WHERE token_id = $1 AND account_id = $2 LIMIT 1",
      [tokenId, accountId]
    );
    if (!res.rows[0]) return null;
    const token = await this.getToken(tokenId);
    if (!token) return null;
    return await this.mapHolder(res.rows[0], token);
  }

  async listHolders(tokenId: string): Promise<HolderRecord[]> {
    await this.init();
    const token = await this.getToken(tokenId);
    if (!token) return [];
    const res = await this.pool.query(
      "SELECT * FROM holders WHERE token_id = $1 ORDER BY created_at ASC",
      [tokenId]
    );
    return Promise.all(res.rows.map((row) => this.mapHolder(row, token)));
  }

  async updateHolder(tokenId: string, accountId: string, patch: UpdateHolderPatch): Promise<HolderRecord | null> {
    await this.init();
    const assignments: string[] = [];
    const values: any[] = [tokenId, accountId];
    let idx = 3;

    const columnMap: Record<keyof UpdateHolderPatch, string> = {
      evmAddress: "evm_address",
      associated: "associated",
      kycGranted: "kyc_granted",
      frozen: "frozen",
      allowanceGranted: "allowance_granted",
      worldIdVerifiedAt: "world_id_verified_at",
      worldIdSelfieVerifiedAt: "world_id_selfie_verified_at",
      worldIdIdentityVerifiedAt: "world_id_identity_verified_at",
      lastCheckinAt: "last_checkin_at",
      activeScheduleId: "active_schedule_id",
      activeScheduleExpiresAt: "active_schedule_expires_at",
      livenessReclaimStatus: "liveness_reclaim_status",
      livenessReclaimError: "liveness_reclaim_error",
      livenessReclaimAttemptedAt: "liveness_reclaim_attempted_at",
      status: "status",
    };

    for (const [key, col] of Object.entries(columnMap)) {
      if (key in patch && (patch as any)[key] !== undefined) {
        assignments.push(`${col} = $${idx}`);
        values.push((patch as any)[key]);
        idx++;
      }
    }

    if (assignments.length === 0) return this.getHolder(tokenId, accountId);
    assignments.push("updated_at = NOW()");

    const query = `UPDATE holders SET ${assignments.join(", ")} WHERE token_id = $1 AND account_id = $2 RETURNING *`;
    const res = await this.pool.query(query, values);
    if (!res.rows[0]) return null;
    const token = await this.getToken(tokenId);
    if (!token) return null;
    return await this.mapHolder(res.rows[0], token);
  }

  async listHoldersDueForLivenessCheck(): Promise<HolderRecord[]> {
    await this.init();
    const res = await this.pool.query(`
      SELECT h.* FROM holders h
      JOIN tokens t ON h.token_id = t.id
      WHERE t.liveness_enabled = TRUE
        AND h.status = 'WHITELISTED'
        AND (
          h.last_checkin_at IS NULL
          OR (NOW() - h.last_checkin_at::timestamptz) > (t.liveness_period_seconds || ' seconds')::interval
        )
    `);
    const results: HolderRecord[] = [];
    for (const row of res.rows) {
      const token = await this.getToken(row.token_id);
      if (token) results.push(await this.mapHolder(row, token));
    }
    return results;
  }

  async claimLivenessReclaim(tokenId: string, accountId: string): Promise<boolean> {
    await this.init();
    const result = await this.pool.query(
      `UPDATE holders
       SET liveness_reclaim_status = 'PROCESSING', liveness_reclaim_error = NULL,
           liveness_reclaim_attempted_at = NOW(), updated_at = NOW()
       WHERE token_id = $1 AND account_id = $2 AND status = 'WHITELISTED'
         AND (
           liveness_reclaim_status = 'IDLE'
           OR (liveness_reclaim_status = 'FAILED'
               AND (liveness_reclaim_attempted_at IS NULL
                    OR liveness_reclaim_attempted_at <= NOW() - INTERVAL '1 minute'))
           OR (liveness_reclaim_status = 'PROCESSING'
               AND liveness_reclaim_attempted_at <= NOW() - INTERVAL '5 minutes'))`,
      [tokenId, accountId]
    );
    return (result.rowCount ?? 0) === 1;
  }

  // --- Events ---

  async insertEvent(params: InsertEventParams): Promise<EventRecord> {
    await this.init();
    const detailJson = params.detail
      ? typeof params.detail === "string"
        ? params.detail
        : JSON.stringify(params.detail)
      : null;

    const res = await this.pool.query(
      `INSERT INTO events (token_id, account_id, type, detail, tx_id, hashscan_url, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       RETURNING *`,
      [params.tokenId, params.accountId ?? null, params.type, detailJson, params.txId ?? null, params.hashscanUrl ?? null]
    );
    return this.mapEvent(res.rows[0]);
  }

  async listEvents(tokenId: string, limit = 100): Promise<EventRecord[]> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM events WHERE token_id = $1 ORDER BY created_at DESC LIMIT $2",
      [tokenId, limit]
    );
    return res.rows.map((r) => this.mapEvent(r));
  }

  // --- Token Requests ---

  async upsertTokenRequest(params: UpsertTokenRequestParams): Promise<TokenRequestRecord> {
    await this.init();
    const res = await this.pool.query(
      `INSERT INTO token_requests (token_id, account_id, amount_base_units, status, created_at, updated_at)
       VALUES ($1, $2, $3, 'PENDING', NOW(), NOW())
       ON CONFLICT (token_id, account_id) DO UPDATE
       SET amount_base_units = EXCLUDED.amount_base_units, updated_at = NOW()
       RETURNING *`,
      [params.tokenId, params.accountId, params.amountBaseUnits]
    );
    return this.mapTokenRequest(res.rows[0]);
  }

  async getTokenRequest(id: number): Promise<TokenRequestRecord | null> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM token_requests WHERE id = $1 LIMIT 1", [id]);
    return res.rows[0] ? this.mapTokenRequest(res.rows[0]) : null;
  }

  async getTokenRequestForHolder(tokenId: string, accountId: string): Promise<TokenRequestRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM token_requests WHERE token_id = $1 AND account_id = $2 LIMIT 1",
      [tokenId, accountId]
    );
    return res.rows[0] ? this.mapTokenRequest(res.rows[0]) : null;
  }

  async listTokenRequestsForToken(tokenId: string): Promise<TokenRequestRecord[]> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM token_requests WHERE token_id = $1 ORDER BY created_at ASC",
      [tokenId]
    );
    return res.rows.map((r) => this.mapTokenRequest(r));
  }

  async listTokenRequests(status?: TokenRequestStatus): Promise<TokenRequestRecord[]> {
    await this.init();
    if (status) {
      const res = await this.pool.query(
        "SELECT * FROM token_requests WHERE status = $1 ORDER BY created_at ASC",
        [status]
      );
      return res.rows.map((r) => this.mapTokenRequest(r));
    }
    const res = await this.pool.query("SELECT * FROM token_requests ORDER BY created_at ASC");
    return res.rows.map((r) => this.mapTokenRequest(r));
  }

  async updateTokenRequest(id: number, patch: UpdateTokenRequestPatch): Promise<TokenRequestRecord | null> {
    await this.init();
    const assignments: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    const columnMap: Record<keyof UpdateTokenRequestPatch, string> = {
      status: "status",
      triggerStatus: "trigger_status",
      triggerError: "trigger_error",
      processingError: "processing_error",
      rejectionReason: "rejection_reason",
      fulfillmentTxId: "fulfillment_tx_id",
      fulfillmentHashscanUrl: "fulfillment_hashscan_url",
    };

    for (const [key, col] of Object.entries(columnMap)) {
      if (key in patch && (patch as any)[key] !== undefined) {
        assignments.push(`${col} = $${idx}`);
        values.push((patch as any)[key]);
        idx++;
      }
    }

    if (assignments.length === 0) return this.getTokenRequest(id);
    assignments.push("updated_at = NOW()");

    const query = `UPDATE token_requests SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] ? this.mapTokenRequest(res.rows[0]) : null;
  }

  async createOrReopenTokenRequest(
    tokenId: string,
    accountId: string,
    amountBaseUnits: string
  ): Promise<{ request: TokenRequestRecord; started: boolean; created: boolean }> {
    await this.init();
    const existing = await this.getTokenRequestForHolder(tokenId, accountId);
    let started = false;
    let created = false;

    if (!existing) {
      const result = await this.pool.query(
        `INSERT INTO token_requests (token_id, account_id, amount_base_units, created_at, updated_at)
         VALUES ($1, $2, $3, NOW(), NOW())
         ON CONFLICT (token_id, account_id) DO NOTHING`,
        [tokenId, accountId, amountBaseUnits]
      );
      started = (result.rowCount ?? 0) === 1;
      created = started;
    } else if (existing.status === "REJECTED") {
      const result = await this.pool.query(
        `UPDATE token_requests
         SET status = 'PENDING', amount_base_units = $1, trigger_status = 'NOT_TRIGGERED',
             trigger_error = NULL, processing_error = NULL, rejection_reason = NULL,
             updated_at = NOW()
         WHERE id = $2 AND status = 'REJECTED'`,
        [amountBaseUnits, existing.id]
      );
      started = (result.rowCount ?? 0) === 1;
    }

    const request = (await this.getTokenRequestForHolder(tokenId, accountId))!;
    return { request, started, created };
  }

  async claimTokenRequest(id: number): Promise<TokenRequestRecord | null> {
    await this.init();
    const result = await this.pool.query(
      `UPDATE token_requests
       SET status = 'PROCESSING', processing_error = NULL, updated_at = NOW()
       WHERE id = $1 AND status = 'PENDING'
       RETURNING *`,
      [id]
    );
    return result.rows[0] ? this.mapTokenRequest(result.rows[0]) : null;
  }

  async rejectPendingTokenRequest(id: number, reason: string): Promise<TokenRequestRecord | null> {
    await this.init();
    const result = await this.pool.query(
      `UPDATE token_requests
       SET status = 'REJECTED', rejection_reason = $1, processing_error = NULL,
           updated_at = NOW()
       WHERE id = $2 AND status = 'PENDING'
       RETURNING *`,
      [reason, id]
    );
    return result.rows[0] ? this.mapTokenRequest(result.rows[0]) : null;
  }

  // --- World ID Verifications ---

  async insertWorldIdVerification(params: InsertWorldIdVerificationParams): Promise<WorldIdVerificationRecord> {
    await this.init();
    const expiresAt = params.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const res = await this.pool.query(
      `INSERT INTO world_id_verifications (
        token_id, account_id, check_kind, status, action, expected_signal, proof_json, proof_hash, created_at, updated_at, expires_at
      ) VALUES ($1, $2, $3, 'PENDING', $4, $5, $6, $7, NOW(), NOW(), $8)
      RETURNING *`,
      [params.tokenId, params.accountId, params.check, params.action, params.expectedSignal, params.proofJson ?? null, params.proofHash ?? null, expiresAt]
    );
    return this.mapWorldIdVerification(res.rows[0]);
  }

  async getWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM world_id_verifications WHERE id = $1 LIMIT 1", [id]);
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async findWorldIdVerificationByAction(
    tokenId: string,
    accountId: string,
    checkKind: string,
    action: string
  ): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query(
      `SELECT * FROM world_id_verifications
       WHERE token_id = $1 AND account_id = $2 AND check_kind = $3 AND action = $4
       ORDER BY created_at DESC LIMIT 1`,
      [tokenId, accountId, checkKind, action]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async findWorldIdVerificationByProofHash(proofHash: string): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM world_id_verifications WHERE proof_hash = $1 LIMIT 1",
      [proofHash]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async findWorldIdVerificationByNullifier(
    tokenId: string,
    checkKind: string,
    nullifierHash: string,
    accountId?: string
  ): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    if (accountId) {
      const res = await this.pool.query(
        `SELECT * FROM world_id_verifications
         WHERE token_id = $1 AND check_kind = $2 AND nullifier_hash = $3 AND account_id = $4
         LIMIT 1`,
        [tokenId, checkKind, nullifierHash, accountId]
      );
      return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
    }
    const res = await this.pool.query(
      "SELECT * FROM world_id_verifications WHERE token_id = $1 AND check_kind = $2 AND nullifier_hash = $3 LIMIT 1",
      [tokenId, checkKind, nullifierHash]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async updateWorldIdVerification(id: number, patch: UpdateWorldIdVerificationPatch): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const assignments: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    const columnMap: Record<keyof UpdateWorldIdVerificationPatch, string> = {
      status: "status",
      proofJson: "proof_json",
      proofHash: "proof_hash",
      credential: "credential",
      nullifierHash: "nullifier_hash",
      errorCode: "error_code",
      errorDetail: "error_detail",
      verifiedAt: "verified_at",
    };

    for (const [key, col] of Object.entries(columnMap)) {
      if (key in patch && (patch as any)[key] !== undefined) {
        assignments.push(`${col} = $${idx}`);
        values.push((patch as any)[key]);
        idx++;
      }
    }

    if (assignments.length === 0) return this.getWorldIdVerification(id);
    assignments.push("updated_at = NOW()");

    const query = `UPDATE world_id_verifications SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`;
    const res = await this.pool.query(query, values);
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async claimWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query(
      `UPDATE world_id_verifications
       SET status = 'PROCESSING', error_code = NULL, error_detail = NULL, updated_at = NOW()
       WHERE id = $1 AND status IN ('PENDING', 'FAILED') AND proof_json IS NOT NULL
       RETURNING *`,
      [id]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async completeWorldIdVerification(
    id: number,
    credential: string,
    nullifierHash: string,
    verifiedAt: string
  ): Promise<WorldIdCompletionResult> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const cur = await client.query(
        `SELECT token_id, account_id, check_kind, action, proof_hash
         FROM world_id_verifications WHERE id = $1`,
        [id]
      );
      if (cur.rows.length === 0) {
        await client.query("COMMIT");
        return { completed: false, code: "verification_missing", message: "Verification not found." };
      }
      const current = cur.rows[0];

      const reject = async (code: string, message: string): Promise<WorldIdCompletionResult> => {
        await client.query(
          `UPDATE world_id_verifications
           SET status = 'REJECTED', proof_json = NULL, error_code = $1, error_detail = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [code, message, id]
        );
        await client.query("COMMIT");
        return { completed: false, code, message };
      };

      if (current.proof_hash) {
        const proofReplay = await client.query(
          `SELECT id FROM world_id_verifications
           WHERE proof_hash = $1 AND id != $2 AND status IN ('VERIFIED', 'REJECTED') LIMIT 1`,
          [current.proof_hash, id]
        );
        if (proofReplay.rows.length > 0) {
          return await reject("proof_replayed", "This exact World ID proof was already submitted.");
        }
      }

      const identityClaim = await client.query(
        `SELECT id FROM world_id_verifications
         WHERE token_id = $1 AND check_kind = $2 AND action = $3 AND nullifier_hash = $4
           AND account_id != $5 AND status = 'VERIFIED' LIMIT 1`,
        [current.token_id, current.check_kind, current.action, nullifierHash, current.account_id]
      );
      if (identityClaim.rows.length > 0) {
        return await reject(
          "identity_already_claimed",
          "This World ID is already linked to another wallet for this token."
        );
      }

      const res = await client.query(
        `UPDATE world_id_verifications
         SET status = 'VERIFIED', proof_json = NULL, credential = $1, nullifier_hash = $2,
             error_code = NULL, error_detail = NULL, verified_at = $3, updated_at = NOW()
         WHERE id = $4 AND status = 'PROCESSING'`,
        [credential, nullifierHash, verifiedAt, id]
      );
      await client.query("COMMIT");

      return (res.rowCount ?? 0) === 1
        ? { completed: true }
        : {
            completed: false,
            code: "verification_not_processing",
            message: "This World ID verification is no longer processing.",
          };
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async failWorldIdVerification(
    id: number,
    errorCode: string,
    errorDetail: string,
    definitive: boolean
  ): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query(
      `UPDATE world_id_verifications
       SET status = $1, proof_json = CASE WHEN $2 THEN NULL ELSE proof_json END,
           error_code = $3, error_detail = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [definitive ? "REJECTED" : "FAILED", definitive, errorCode, errorDetail, id]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  async getWorldIdVerificationProof(id: number): Promise<{
    verification: WorldIdVerificationRecord;
    proof: unknown;
  } | null> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM world_id_verifications WHERE id = $1 LIMIT 1", [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    const verification = this.mapWorldIdVerification(row);
    if (!row.proof_json) return { verification, proof: null };
    return { verification, proof: JSON.parse(row.proof_json) as unknown };
  }

  async listWorldIdVerifications(filters: {
    status?: WorldIdVerificationStatus;
    tokenId?: string;
    accountId?: string;
  } = {}): Promise<WorldIdVerificationRecord[]> {
    await this.init();
    const clauses: string[] = [];
    const values: any[] = [];
    let idx = 1;
    if (filters.status) {
      clauses.push(`status = $${idx++}`);
      values.push(filters.status);
    }
    if (filters.tokenId) {
      clauses.push(`token_id = $${idx++}`);
      values.push(filters.tokenId);
    }
    if (filters.accountId) {
      clauses.push(`account_id = $${idx++}`);
      values.push(filters.accountId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const res = await this.pool.query(
      `SELECT * FROM world_id_verifications ${where} ORDER BY created_at ASC, id ASC`,
      values
    );
    return res.rows.map((row) => this.mapWorldIdVerification(row));
  }

  async getLatestWorldIdVerification(
    tokenId: string,
    accountId: string,
    check: WorldIdCheckKind
  ): Promise<WorldIdVerificationRecord | null> {
    await this.init();
    const res = await this.pool.query(
      `SELECT * FROM world_id_verifications
       WHERE token_id = $1 AND account_id = $2 AND check_kind = $3
       ORDER BY id DESC LIMIT 1`,
      [tokenId, accountId, check]
    );
    return res.rows[0] ? this.mapWorldIdVerification(res.rows[0]) : null;
  }

  // --- Auth Sessions & Nonces ---

  async createAuthNonce(address: string): Promise<string> {
    await this.init();
    const nonce = randomUUID();
    const now = Date.now();
    const expiresAt = now + 300_000; // 5 min TTL
    await this.pool.query(
      `INSERT INTO auth_nonces (nonce, address, consumed, issued_at, expires_at)
       VALUES ($1, $2, FALSE, $3, $4)`,
      [nonce, address.toLowerCase(), now, expiresAt]
    );
    return nonce;
  }

  async consumeAuthNonce(nonce: string, address: string): Promise<boolean> {
    await this.init();
    const now = Date.now();
    const res = await this.pool.query(
      `UPDATE auth_nonces
       SET consumed = TRUE
       WHERE nonce = $1 AND address = $2 AND consumed = FALSE AND expires_at >= $3
       RETURNING nonce`,
      [nonce, address.toLowerCase(), now]
    );
    return (res.rowCount ?? 0) > 0;
  }

  async createAuthSession(params: CreateAuthSessionParams): Promise<string> {
    await this.init();
    const id = randomUUID();
    const now = Date.now();
    await this.pool.query(
      `INSERT INTO auth_sessions (id, address, role, issued_at, expires_at, revoked, user_agent, ip)
       VALUES ($1, $2, $3, $4, $5, FALSE, $6, $7)`,
      [id, params.address.toLowerCase(), params.role, now, params.expiresAt, params.userAgent ?? null, params.ip ?? null]
    );
    return id;
  }

  async getAuthSession(sessionId: string): Promise<AuthSessionRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM auth_sessions WHERE id = $1 LIMIT 1",
      [sessionId]
    );
    if (!res.rows[0]) return null;
    const r = res.rows[0];
    return {
      id: r.id,
      address: r.address,
      role: r.role,
      issuedAt: Number(r.issued_at),
      expiresAt: Number(r.expires_at),
      revoked: Boolean(r.revoked),
      userAgent: r.user_agent,
      ip: r.ip,
    };
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE auth_sessions SET revoked = TRUE WHERE id = $1", [sessionId]);
  }

  // --- Agent Sessions, Nonces & Spend ---

  async saveAgentSession(session: AgentSessionRecord): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO agent_sessions (
        id, grantor, agent_address, validator_contract, max_spend_hbar, max_flow_monthly_usd,
        allowed_actions, chain_id, nonce, expires_at, signature, signature_type,
        spent_hbar, active_streams, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (grantor, nonce) DO UPDATE SET
        id = EXCLUDED.id,
        agent_address = EXCLUDED.agent_address,
        validator_contract = EXCLUDED.validator_contract,
        max_spend_hbar = EXCLUDED.max_spend_hbar,
        max_flow_monthly_usd = EXCLUDED.max_flow_monthly_usd,
        allowed_actions = EXCLUDED.allowed_actions,
        chain_id = EXCLUDED.chain_id,
        expires_at = EXCLUDED.expires_at,
        signature = EXCLUDED.signature,
        signature_type = EXCLUDED.signature_type,
        spent_hbar = EXCLUDED.spent_hbar,
        active_streams = EXCLUDED.active_streams,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at`,
      [
        session.id,
        session.grantor.toLowerCase(),
        session.agentAddress.toLowerCase(),
        session.validatorContract.toLowerCase(),
        session.maxSpendHbar,
        session.maxFlowMonthlyUsd,
        JSON.stringify(session.allowedActions),
        session.chainId,
        session.nonce,
        session.expiresAt,
        session.signature,
        session.signatureType,
        session.spentHbar ?? 0,
        session.activeStreams ?? 0,
        session.status ?? "ACTIVE",
        session.createdAt ?? Date.now(),
      ]
    );
  }

  async getAgentSession(id: string): Promise<AgentSessionRecord | null> {
    await this.init();
    const res = await this.pool.query("SELECT * FROM agent_sessions WHERE id = $1 LIMIT 1", [id]);
    return res.rows[0] ? this.mapAgentSession(res.rows[0]) : null;
  }

  async getActiveAgentSession(grantor: string): Promise<AgentSessionRecord | null> {
    await this.init();
    const res = await this.pool.query(
      `SELECT * FROM agent_sessions
       WHERE LOWER(grantor) = LOWER($1) AND status = 'ACTIVE' AND expires_at > $2
       ORDER BY created_at DESC LIMIT 1`,
      [grantor.toLowerCase(), Date.now()]
    );
    return res.rows[0] ? this.mapAgentSession(res.rows[0]) : null;
  }

  async getAgentSessionByGrantor(grantor: string, nonce: number): Promise<AgentSessionRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM agent_sessions WHERE grantor = $1 AND nonce = $2 LIMIT 1",
      [grantor.toLowerCase(), nonce]
    );
    return res.rows[0] ? this.mapAgentSession(res.rows[0]) : null;
  }

  async updateAgentSessionStatus(sessionId: string, status: string): Promise<void> {
    await this.init();
    await this.pool.query("UPDATE agent_sessions SET status = $1 WHERE id = $2", [status, sessionId]);
  }

  async validateAndSpendAgentSession(
    sessionId: string,
    action: string,
    spendHbar = 0,
    flowRateMonthly = 0,
    requestNonce: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    remainingHbar: number;
    session: AgentSessionRecord | null;
  }> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const res = await client.query("SELECT * FROM agent_sessions WHERE id = $1 FOR UPDATE", [sessionId]);
      if (res.rows.length === 0) {
        await client.query("ROLLBACK");
        return { allowed: false, reason: "Session key record not found.", remainingHbar: 0, session: null };
      }
      const session = this.mapAgentSession(res.rows[0]);
      if (session.status !== "ACTIVE") {
        await client.query("ROLLBACK");
        return { allowed: false, reason: `Session key is ${session.status}. Re-authorization required.`, remainingHbar: 0, session };
      }
      if (Date.now() > session.expiresAt) {
        await client.query("UPDATE agent_sessions SET status = 'EXPIRED' WHERE id = $1", [sessionId]);
        await client.query("COMMIT");
        session.status = "EXPIRED";
        return { allowed: false, reason: "Session key has expired. Re-authorization required.", remainingHbar: 0, session };
      }
      if (!session.allowedActions.includes(action)) {
        await client.query("ROLLBACK");
        return {
          allowed: false,
          reason: `Cryptographic Policy Violation: Action '${action}' is not in delegated allowlist.`,
          remainingHbar: Math.max(0, session.maxSpendHbar - (session.spentHbar ?? 0)),
          session,
        };
      }
      const remaining = session.maxSpendHbar - (session.spentHbar ?? 0);
      if (spendHbar > 0 && spendHbar > remaining) {
        await client.query("ROLLBACK");
        return {
          allowed: false,
          reason: `Budget Cap Exceeded: Requested ${spendHbar} HBAR exceeds remaining allowance (${remaining.toFixed(2)} HBAR).`,
          remainingHbar: remaining,
          session,
        };
      }
      if (flowRateMonthly > 0 && flowRateMonthly > session.maxFlowMonthlyUsd) {
        await client.query("ROLLBACK");
        return {
          allowed: false,
          reason: `Yield Ceiling Violation: Requested monthly stream of $${flowRateMonthly} exceeds permitted maximum of $${session.maxFlowMonthlyUsd}.`,
          remainingHbar: remaining,
          session,
        };
      }
      const nonceRes = await client.query(
        "SELECT nonce FROM agent_nonces WHERE session_id = $1 AND nonce = $2",
        [sessionId, requestNonce]
      );
      if (nonceRes.rows.length > 0) {
        await client.query("ROLLBACK");
        return {
          allowed: false,
          reason: "Request nonce already used. Replay detected and rejected.",
          remainingHbar: remaining,
          session,
        };
      }
      await client.query(
        "INSERT INTO agent_nonces (session_id, nonce, used_at) VALUES ($1, $2, $3)",
        [sessionId, requestNonce, Date.now()]
      );
      if (spendHbar > 0) {
        await client.query(
          "UPDATE agent_sessions SET spent_hbar = spent_hbar + $1 WHERE id = $2",
          [spendHbar, sessionId]
        );
        await client.query(
          "INSERT INTO agent_spend_log (session_id, action, spend_hbar, timestamp) VALUES ($1, $2, $3, $4)",
          [sessionId, action, spendHbar, Date.now()]
        );
      }
      const updatedRes = await client.query("SELECT * FROM agent_sessions WHERE id = $1", [sessionId]);
      await client.query("COMMIT");
      const updatedSession = this.mapAgentSession(updatedRes.rows[0]);
      return {
        allowed: true,
        remainingHbar: Math.max(0, updatedSession.maxSpendHbar - (updatedSession.spentHbar ?? 0)),
        session: updatedSession,
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }

  async consumeAgentNonce(sessionId: string, nonce: string): Promise<boolean> {
    await this.init();
    try {
      const res = await this.pool.query(
        `INSERT INTO agent_nonces (session_id, nonce, used_at)
         VALUES ($1, $2, $3)
         ON CONFLICT (session_id, nonce) DO NOTHING
         RETURNING nonce`,
        [sessionId, nonce, Date.now()]
      );
      return (res.rowCount ?? 0) > 0;
    } catch {
      return false;
    }
  }

  async recordAgentSpend(sessionId: string, action: string, amountHbar: number): Promise<void> {
    await this.init();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        "UPDATE agent_sessions SET spent_hbar = spent_hbar + $1 WHERE id = $2",
        [amountHbar, sessionId]
      );
      await client.query(
        `INSERT INTO agent_spend_log (session_id, action, spend_hbar, timestamp)
         VALUES ($1, $2, $3, $4)`,
        [sessionId, action, amountHbar, Date.now()]
      );
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async consumeAgentRequestNonce(nonce: string, expiresAt: number): Promise<boolean> {
    await this.init();
    const now = Date.now();
    try {
      await this.pool.query(
        `INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at)
         VALUES ($1, $2, $3)`,
        [nonce, expiresAt, now]
      );
      return true;
    } catch {
      return false;
    }
  }

  async purgeExpiredAgentRequestNonces(now = Date.now()): Promise<number> {
    await this.init();
    const res = await this.pool.query("DELETE FROM agent_request_nonces WHERE expires_at < $1", [now]);
    return res.rowCount ?? 0;
  }

  // --- Outbox Queue ---

  async enqueueOutboxJob(params: EnqueueOutboxParams): Promise<OutboxJobRecord> {
    await this.init();
    const now = Date.now();
    const payloadStr = JSON.stringify(params.payload);

    if (params.idempotencyKey) {
      const existing = await this.getOutboxJobByIdempotencyKey(params.idempotencyKey);
      if (existing) return existing;
    }

    const res = await this.pool.query(
      `INSERT INTO outbox (type, payload, status, idempotency_key, created_at, updated_at)
       VALUES ($1, $2, 'PENDING', $3, $4, $4)
       RETURNING *`,
      [params.type, payloadStr, params.idempotencyKey ?? null, now]
    );
    return this.mapOutbox(res.rows[0]);
  }

  async claimPendingOutboxJobs(limit = 10): Promise<OutboxJobRecord[]> {
    await this.init();
    const now = Date.now();
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const sel = await client.query(
        `SELECT id FROM outbox
         WHERE status = 'PENDING'
         ORDER BY created_at ASC
         LIMIT $1
         FOR UPDATE`,
        [limit]
      );
      if (sel.rows.length === 0) {
        await client.query("COMMIT");
        return [];
      }
      const ids = sel.rows.map((r) => Number(r.id));
      const placeholders = ids.map((_, i) => `$${i + 2}`).join(", ");
      const res = await client.query(
        `UPDATE outbox
         SET status = 'PROCESSING', attempts = attempts + 1, updated_at = $1
         WHERE id IN (${placeholders})
         RETURNING *`,
        [now, ...ids]
      );
      await client.query("COMMIT");
      return res.rows.map((r) => this.mapOutbox(r));
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }

  async completeOutboxJob(id: number, result?: Record<string, unknown>): Promise<void> {
    await this.init();
    const now = Date.now();
    const resStr = result ? JSON.stringify(result) : null;
    await this.pool.query(
      `UPDATE outbox
       SET status = 'COMPLETED', result = $1, updated_at = $2
       WHERE id = $3`,
      [resStr, now, id]
    );
  }

  async failOutboxJob(id: number, error: string, maxAttempts = 5): Promise<void> {
    await this.init();
    const now = Date.now();
    const check = await this.pool.query("SELECT attempts FROM outbox WHERE id = $1", [id]);
    const attempts = ((check.rows[0]?.attempts ?? 0) as number) + 1;
    const finalStatus = attempts >= maxAttempts ? "FAILED" : "PENDING";
    await this.pool.query(
      `UPDATE outbox
       SET status = $1, attempts = $2, last_error = $3, updated_at = $4
       WHERE id = $5`,
      [finalStatus, attempts, error, now, id]
    );
  }

  async getOutboxJobByIdempotencyKey(key: string): Promise<OutboxJobRecord | null> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM outbox WHERE idempotency_key = $1 LIMIT 1",
      [key]
    );
    return res.rows[0] ? this.mapOutbox(res.rows[0]) : null;
  }

  // --- Audit Logs ---

  async insertAuditLog(event: AuditEvent): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO audit_log (actor, role, action, resource, status, detail, ip, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        event.actor,
        event.role,
        event.action,
        event.resource,
        event.status,
        event.detail ? JSON.stringify(event.detail) : null,
        event.ip ?? null,
      ]
    );
  }

  async listAuditLogs(limit = 100): Promise<AuditLogRow[]> {
    await this.init();
    const res = await this.pool.query(
      "SELECT * FROM audit_log ORDER BY created_at DESC LIMIT $1",
      [limit]
    );
    return res.rows;
  }

  // --- Row Mappers ---

  private mapToken(row: any): TokenRecord {
    const blockchain = row.blockchain as Blockchain;
    const network = row.network as TokenNetwork;
    const explorerUrl = tokenExplorerUrl(blockchain, network, row.id);
    return {
      id: row.id,
      blockchain,
      network,
      name: row.name,
      symbol: row.symbol,
      tokenType: row.token_type as TokenType,
      decimals: row.decimals,
      initialSupply: row.initial_supply,
      supplyType: row.supply_type as SupplyType,
      maxSupply: row.max_supply,
      treasuryAccountId: row.treasury_account_id,
      assetCategory: row.asset_category as AssetCategory,
      memo: row.memo,
      compliance: {
        kycRequired: Boolean(row.kyc_required),
        freezeDefault: Boolean(row.freeze_default),
        wipeEnabled: Boolean(row.wipe_enabled),
        pauseEnabled: Boolean(row.pause_enabled),
        worldIdRequired: Boolean(row.world_id_required),
        worldIdSelfieCheck: Boolean(row.world_id_selfie_check),
        worldIdMinimumAge: row.world_id_minimum_age ?? undefined,
        worldIdNationality: row.world_id_nationality ?? undefined,
        livenessEnabled: Boolean(row.liveness_enabled),
        livenessPeriodSeconds: row.liveness_period_seconds ?? undefined,
      },
      customFee: row.custom_fee_enabled && row.custom_fee_config
        ? (JSON.parse(row.custom_fee_config) as CustomFeeConfig)
        : null,
      keys: {
        admin: Boolean(row.has_admin_key),
        kyc: Boolean(row.has_kyc_key),
        freeze: Boolean(row.has_freeze_key),
        wipe: Boolean(row.has_wipe_key),
        pause: Boolean(row.has_pause_key),
        supply: Boolean(row.has_supply_key),
        feeSchedule: Boolean(row.has_fee_schedule_key),
      },
      paused: Boolean(row.paused),
      createTxId: row.create_tx_id,
      hashscanUrl: explorerUrl,
      explorerUrl,
      explorerName: blockchain === "EVM" ? "Etherscan" : "HashScan",
      createdAt: typeof row.created_at === "object" ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private async mapHolder(row: any, token: TokenRecord): Promise<HolderRecord> {
    const lastCheckinAt = row.last_checkin_at ?? null;
    let livenessState: HolderRecord["livenessState"] = "DISABLED";
    if (token.compliance.livenessEnabled && token.compliance.livenessPeriodSeconds) {
      if (!lastCheckinAt) {
        livenessState = "EXPIRED";
      } else {
        const last = new Date(lastCheckinAt).getTime();
        const diffSec = (Date.now() - last) / 1000;
        livenessState = diffSec > token.compliance.livenessPeriodSeconds ? "EXPIRED" : "OK";
      }
    }

    const selfieRes = await this.pool.query(
      "SELECT * FROM world_id_verifications WHERE token_id = $1 AND account_id = $2 AND check_kind = 'selfie' ORDER BY id DESC LIMIT 1",
      [row.token_id, row.account_id]
    );
    const identityRes = await this.pool.query(
      "SELECT * FROM world_id_verifications WHERE token_id = $1 AND account_id = $2 AND check_kind = 'identity' ORDER BY id DESC LIMIT 1",
      [row.token_id, row.account_id]
    );

    return {
      tokenId: row.token_id,
      accountId: row.account_id,
      evmAddress: row.evm_address,
      associated: Boolean(row.associated),
      kycGranted: Boolean(row.kyc_granted),
      frozen: Boolean(row.frozen),
      allowanceGranted: Boolean(row.allowance_granted),
      worldIdVerifiedAt: row.world_id_verified_at,
      worldIdSelfieVerifiedAt: row.world_id_selfie_verified_at,
      worldIdIdentityVerifiedAt: row.world_id_identity_verified_at,
      worldIdSelfieVerification: selfieRes.rows[0] ? this.mapWorldIdVerification(selfieRes.rows[0]) : null,
      worldIdIdentityVerification: identityRes.rows[0] ? this.mapWorldIdVerification(identityRes.rows[0]) : null,
      lastCheckinAt,
      livenessState,
      activeScheduleId: row.active_schedule_id,
      activeScheduleExpiresAt: row.active_schedule_expires_at,
      livenessReclaimStatus: (row.liveness_reclaim_status as LivenessReclaimStatus) ?? "IDLE",
      livenessReclaimError: row.liveness_reclaim_error,
      livenessReclaimAttemptedAt: row.liveness_reclaim_attempted_at,
      status: row.status as HolderStatus,
      createdAt: typeof row.created_at === "object" ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: typeof row.updated_at === "object" ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private mapEvent(row: any): EventRecord {
    return {
      id: row.id,
      tokenId: row.token_id,
      accountId: row.account_id,
      type: row.type,
      detail: row.detail ? JSON.parse(row.detail) : null,
      txId: row.tx_id,
      hashscanUrl: row.hashscan_url,
      createdAt: typeof row.created_at === "object" ? row.created_at.toISOString() : String(row.created_at),
    };
  }

  private mapTokenRequest(row: any): TokenRequestRecord {
    return {
      id: row.id,
      tokenId: row.token_id,
      accountId: row.account_id,
      amountBaseUnits: row.amount_base_units,
      status: row.status as TokenRequestStatus,
      triggerStatus: row.trigger_status as HermesTriggerStatus,
      triggerError: row.trigger_error,
      processingError: row.processing_error,
      rejectionReason: row.rejection_reason,
      fulfillmentTxId: row.fulfillment_tx_id,
      fulfillmentHashscanUrl: row.fulfillment_hashscan_url,
      createdAt: typeof row.created_at === "object" ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: typeof row.updated_at === "object" ? row.updated_at.toISOString() : String(row.updated_at),
    };
  }

  private mapWorldIdVerification(row: any): WorldIdVerificationRecord {
    return {
      id: row.id,
      tokenId: row.token_id,
      accountId: row.account_id,
      check: row.check_kind as WorldIdCheckKind,
      status: row.status as WorldIdVerificationStatus,
      action: row.action,
      expectedSignal: row.expected_signal,
      credential: row.credential,
      nullifierHash: row.nullifier_hash,
      errorCode: row.error_code,
      errorDetail: row.error_detail,
      createdAt: typeof row.created_at === "object" ? row.created_at.toISOString() : String(row.created_at),
      updatedAt: typeof row.updated_at === "object" ? row.updated_at.toISOString() : String(row.updated_at),
      expiresAt: typeof row.expires_at === "object" ? row.expires_at.toISOString() : String(row.expires_at),
      verifiedAt: row.verified_at,
    };
  }

  private mapAgentSession(row: any): AgentSessionRecord {
    return {
      id: row.id,
      grantor: row.grantor,
      agentAddress: row.agent_address,
      validatorContract: row.validator_contract,
      maxSpendHbar: Number(row.max_spend_hbar),
      maxFlowMonthlyUsd: Number(row.max_flow_monthly_usd),
      allowedActions: JSON.parse(row.allowed_actions),
      chainId: Number(row.chain_id),
      nonce: Number(row.nonce),
      expiresAt: Number(row.expires_at),
      signature: row.signature,
      signatureType: row.signature_type,
      spentHbar: Number(row.spent_hbar),
      activeStreams: Number(row.active_streams),
      status: row.status,
      createdAt: Number(row.created_at),
    };
  }

  private mapOutbox(row: any): OutboxJobRecord {
    return {
      id: row.id,
      type: row.type,
      payload: JSON.parse(row.payload),
      status: row.status,
      attempts: Number(row.attempts),
      lastError: row.last_error,
      idempotencyKey: row.idempotency_key,
      result: row.result ? JSON.parse(row.result) : null,
      createdAt: Number(row.created_at),
      updatedAt: Number(row.updated_at),
    };
  }
}
