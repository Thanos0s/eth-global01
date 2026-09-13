import Database from "better-sqlite3";
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
import { getDb } from "./index";

export class SqliteAdapter implements IDatabaseAdapter {
  private db: Database.Database;

  constructor(db?: Database.Database) {
    this.db = db ?? getDb();
  }

  getDialect(): "sqlite" {
    return "sqlite";
  }

  async init(): Promise<void> {
    // Database and migrations are already initialized in getDb()
  }

  async getHealth(): Promise<DatabaseHealthInfo> {
    const start = Date.now();
    try {
      this.db.prepare("SELECT 1").get();
      return {
        dialect: "sqlite",
        status: "ok",
        migrationStatus: "applied",
        latencyMs: Date.now() - start,
      };
    } catch (err: any) {
      return {
        dialect: "sqlite",
        status: "degraded",
        migrationStatus: "pending",
        latencyMs: Date.now() - start,
        error: err.message,
      };
    }
  }

  // --- Tokens ---

  async insertToken(params: InsertTokenParams): Promise<TokenRecord> {
    this.db.prepare(`
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
        @id, @blockchain, @network, @name, @symbol, @tokenType, @decimals, @initialSupply, @supplyType, @maxSupply,
        @treasuryAccountId, @assetCategory, @memo,
        @kycRequired, @freezeDefault, @wipeEnabled, @pauseEnabled, @worldIdRequired,
        @worldIdSelfieCheck, @worldIdMinimumAge, @worldIdNationality,
        @livenessEnabled, @livenessPeriodSeconds,
        @customFeeEnabled, @customFeeConfig,
        @hasAdminKey, @hasKycKey, @hasFreezeKey, @hasWipeKey, @hasPauseKey, @hasSupplyKey, @hasFeeScheduleKey,
        @createTxId
      )
    `).run({
      id: params.id,
      blockchain: params.blockchain ?? "HEDERA",
      network: params.network ?? "testnet",
      name: params.name,
      symbol: params.symbol,
      tokenType: params.tokenType,
      decimals: params.decimals,
      initialSupply: String(params.initialSupply),
      supplyType: params.supplyType,
      maxSupply: params.maxSupply != null ? String(params.maxSupply) : null,
      treasuryAccountId: params.treasuryAccountId,
      assetCategory: params.assetCategory,
      memo: params.memo ?? null,
      kycRequired: params.compliance.kycRequired ? 1 : 0,
      freezeDefault: params.compliance.freezeDefault ? 1 : 0,
      wipeEnabled: params.compliance.wipeEnabled ? 1 : 0,
      pauseEnabled: params.compliance.pauseEnabled ? 1 : 0,
      worldIdRequired: params.compliance.worldIdRequired ? 1 : 0,
      worldIdSelfieCheck: params.compliance.worldIdSelfieCheck ? 1 : 0,
      worldIdMinimumAge: params.compliance.worldIdMinimumAge ?? null,
      worldIdNationality: params.compliance.worldIdNationality ?? null,
      livenessEnabled: params.compliance.livenessEnabled ? 1 : 0,
      livenessPeriodSeconds: params.compliance.livenessPeriodSeconds ?? null,
      customFeeEnabled: params.customFee ? 1 : 0,
      customFeeConfig: params.customFee ? JSON.stringify(params.customFee) : null,
      hasAdminKey: params.keys.admin ? 1 : 0,
      hasKycKey: params.keys.kyc ? 1 : 0,
      hasFreezeKey: params.keys.freeze ? 1 : 0,
      hasWipeKey: params.keys.wipe ? 1 : 0,
      hasPauseKey: params.keys.pause ? 1 : 0,
      hasSupplyKey: params.keys.supply ? 1 : 0,
      hasFeeScheduleKey: params.keys.feeSchedule ? 1 : 0,
      createTxId: params.createTxId,
    });

    const token = await this.getToken(params.id);
    if (!token) throw new Error("Failed to retrieve created token");
    return token;
  }

  async getToken(id: string): Promise<TokenRecord | null> {
    const row = this.db.prepare("SELECT * FROM tokens WHERE id = ?").get(id) as any;
    return row ? this.mapToken(row) : null;
  }

  async listTokens(): Promise<TokenRecord[]> {
    const rows = this.db.prepare("SELECT * FROM tokens ORDER BY created_at DESC").all() as any[];
    return rows.map((r) => this.mapToken(r));
  }

  async setTokenPaused(id: string, paused: boolean): Promise<TokenRecord | null> {
    this.db.prepare("UPDATE tokens SET paused = ? WHERE id = ?").run(paused ? 1 : 0, id);
    return this.getToken(id);
  }

  // --- Holders ---

  async ensureHolder(tokenId: string, accountId: string, evmAddress?: string | null): Promise<HolderRecord> {
    this.db.prepare(`
      INSERT OR IGNORE INTO holders (token_id, account_id, evm_address, status)
      VALUES (?, ?, ?, 'PENDING')
    `).run(tokenId, accountId, evmAddress ?? null);

    if (evmAddress) {
      this.db.prepare(`
        UPDATE holders SET evm_address = ?
        WHERE token_id = ? AND account_id = ? AND evm_address IS NULL
      `).run(evmAddress, tokenId, accountId);
    }

    const holder = await this.getHolder(tokenId, accountId);
    if (!holder) throw new Error("Failed to ensure holder row exists");
    return holder;
  }

  async getHolder(tokenId: string, accountId: string): Promise<HolderRecord | null> {
    const row = this.db.prepare(
      "SELECT * FROM holders WHERE token_id = ? AND account_id = ?"
    ).get(tokenId, accountId) as any;
    if (!row) return null;
    const token = await this.getToken(tokenId);
    if (!token) return null;
    return this.mapHolder(row, token);
  }

  async listHolders(tokenId: string): Promise<HolderRecord[]> {
    const token = await this.getToken(tokenId);
    if (!token) return [];
    const rows = this.db.prepare(
      "SELECT * FROM holders WHERE token_id = ? ORDER BY created_at ASC"
    ).all(tokenId) as any[];
    return rows.map((r) => this.mapHolder(r, token));
  }

  async updateHolder(tokenId: string, accountId: string, patch: UpdateHolderPatch): Promise<HolderRecord | null> {
    const assignments: string[] = [];
    const values: any[] = [];

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
        assignments.push(`${col} = ?`);
        let val = (patch as any)[key];
        if (typeof val === "boolean") val = val ? 1 : 0;
        values.push(val);
      }
    }

    if (assignments.length === 0) return this.getHolder(tokenId, accountId);
    assignments.push("updated_at = datetime('now')");
    values.push(tokenId, accountId);

    const query = `UPDATE holders SET ${assignments.join(", ")} WHERE token_id = ? AND account_id = ?`;
    this.db.prepare(query).run(...values);
    return this.getHolder(tokenId, accountId);
  }

  async listHoldersDueForLivenessCheck(): Promise<HolderRecord[]> {
    const rows = this.db.prepare(`
      SELECT h.* FROM holders h
      JOIN tokens t ON h.token_id = t.id
      WHERE t.liveness_enabled = 1
        AND h.status = 'WHITELISTED'
        AND (
          h.last_checkin_at IS NULL
          OR unixepoch('now') - unixepoch(h.last_checkin_at) > t.liveness_period_seconds
        )
    `).all() as any[];

    const results: HolderRecord[] = [];
    for (const row of rows) {
      const token = await this.getToken(row.token_id);
      if (token) results.push(this.mapHolder(row, token));
    }
    return results;
  }

  async claimLivenessReclaim(tokenId: string, accountId: string): Promise<boolean> {
    const result = this.db
      .prepare(
        `UPDATE holders
         SET liveness_reclaim_status = 'PROCESSING', liveness_reclaim_error = NULL,
             liveness_reclaim_attempted_at = datetime('now'), updated_at = datetime('now')
         WHERE token_id = ? AND account_id = ? AND status = 'WHITELISTED'
           AND (
             liveness_reclaim_status = 'IDLE'
             OR (liveness_reclaim_status = 'FAILED'
                 AND (liveness_reclaim_attempted_at IS NULL
                      OR liveness_reclaim_attempted_at <= datetime('now', '-1 minute')))
             OR (liveness_reclaim_status = 'PROCESSING'
                 AND liveness_reclaim_attempted_at <= datetime('now', '-5 minutes'))
           )`
      )
      .run(tokenId, accountId);
    return result.changes === 1;
  }

  // --- Events ---

  async insertEvent(params: InsertEventParams): Promise<EventRecord> {
    const detailJson = params.detail
      ? typeof params.detail === "string"
        ? params.detail
        : JSON.stringify(params.detail)
      : null;

    const res = this.db.prepare(`
      INSERT INTO events (token_id, account_id, type, detail, tx_id, hashscan_url)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(
      params.tokenId,
      params.accountId ?? null,
      params.type,
      detailJson,
      params.txId ?? null,
      params.hashscanUrl ?? null
    );

    const row = this.db.prepare("SELECT * FROM events WHERE id = ?").get(res.lastInsertRowid) as any;
    return this.mapEvent(row);
  }

  async listEvents(tokenId: string, limit = 100): Promise<EventRecord[]> {
    const rows = this.db.prepare(
      "SELECT * FROM events WHERE token_id = ? ORDER BY created_at DESC LIMIT ?"
    ).all(tokenId, limit) as any[];
    return rows.map((r) => this.mapEvent(r));
  }

  // --- Token Requests ---

  async upsertTokenRequest(params: UpsertTokenRequestParams): Promise<TokenRequestRecord> {
    this.db.prepare(`
      INSERT INTO token_requests (token_id, account_id, amount_base_units, status)
      VALUES (@tokenId, @accountId, @amountBaseUnits, 'PENDING')
      ON CONFLICT(token_id, account_id) DO UPDATE SET
        amount_base_units = excluded.amount_base_units,
        updated_at = datetime('now')
    `).run({
      tokenId: params.tokenId,
      accountId: params.accountId,
      amountBaseUnits: params.amountBaseUnits,
    });

    const record = await this.getTokenRequestForHolder(params.tokenId, params.accountId);
    if (!record) throw new Error("Failed to load upserted token request");
    return record;
  }

  async getTokenRequest(id: number): Promise<TokenRequestRecord | null> {
    const row = this.db.prepare("SELECT * FROM token_requests WHERE id = ?").get(id) as any;
    return row ? this.mapTokenRequest(row) : null;
  }

  async getTokenRequestForHolder(tokenId: string, accountId: string): Promise<TokenRequestRecord | null> {
    const row = this.db.prepare(
      "SELECT * FROM token_requests WHERE token_id = ? AND account_id = ?"
    ).get(tokenId, accountId) as any;
    return row ? this.mapTokenRequest(row) : null;
  }

  async listTokenRequestsForToken(tokenId: string): Promise<TokenRequestRecord[]> {
    const rows = this.db.prepare(
      "SELECT * FROM token_requests WHERE token_id = ? ORDER BY created_at ASC"
    ).all(tokenId) as any[];
    return rows.map((r) => this.mapTokenRequest(r));
  }

  async listTokenRequests(status?: TokenRequestStatus): Promise<TokenRequestRecord[]> {
    if (status) {
      const rows = this.db.prepare(
        "SELECT * FROM token_requests WHERE status = ? ORDER BY created_at ASC"
      ).all(status) as any[];
      return rows.map((r) => this.mapTokenRequest(r));
    }
    const rows = this.db.prepare("SELECT * FROM token_requests ORDER BY created_at ASC").all() as any[];
    return rows.map((r) => this.mapTokenRequest(r));
  }

  async updateTokenRequest(id: number, patch: UpdateTokenRequestPatch): Promise<TokenRequestRecord | null> {
    const assignments: string[] = [];
    const values: any[] = [];

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
        assignments.push(`${col} = ?`);
        values.push((patch as any)[key]);
      }
    }

    if (assignments.length === 0) return this.getTokenRequest(id);
    assignments.push("updated_at = datetime('now')");
    values.push(id);

    const query = `UPDATE token_requests SET ${assignments.join(", ")} WHERE id = ?`;
    this.db.prepare(query).run(...values);
    return this.getTokenRequest(id);
  }

  async createOrReopenTokenRequest(
    tokenId: string,
    accountId: string,
    amountBaseUnits: string
  ): Promise<{ request: TokenRequestRecord; started: boolean; created: boolean }> {
    const existing = await this.getTokenRequestForHolder(tokenId, accountId);
    let started = false;
    let created = false;

    if (!existing) {
      const result = this.db
        .prepare(
          `INSERT INTO token_requests (token_id, account_id, amount_base_units)
           VALUES (?, ?, ?)
           ON CONFLICT(token_id, account_id) DO NOTHING`
        )
        .run(tokenId, accountId, amountBaseUnits);
      started = result.changes === 1;
      created = started;
    } else if (existing.status === "REJECTED") {
      const result = this.db
        .prepare(
          `UPDATE token_requests
           SET status = 'PENDING', amount_base_units = ?, trigger_status = 'NOT_TRIGGERED',
               trigger_error = NULL, processing_error = NULL, rejection_reason = NULL,
               updated_at = datetime('now')
           WHERE id = ? AND status = 'REJECTED'`
        )
        .run(amountBaseUnits, existing.id);
      started = result.changes === 1;
    }

    const request = (await this.getTokenRequestForHolder(tokenId, accountId))!;
    return { request, started, created };
  }

  async claimTokenRequest(id: number): Promise<TokenRequestRecord | null> {
    const result = this.db
      .prepare(
        `UPDATE token_requests
         SET status = 'PROCESSING', processing_error = NULL, updated_at = datetime('now')
         WHERE id = ? AND status = 'PENDING'`
      )
      .run(id);
    return result.changes === 1 ? this.getTokenRequest(id) : null;
  }

  async rejectPendingTokenRequest(id: number, reason: string): Promise<TokenRequestRecord | null> {
    const result = this.db
      .prepare(
        `UPDATE token_requests
         SET status = 'REJECTED', rejection_reason = ?, processing_error = NULL,
             updated_at = datetime('now')
         WHERE id = ? AND status = 'PENDING'`
      )
      .run(reason, id);
    return result.changes === 1 ? this.getTokenRequest(id) : null;
  }

  // --- World ID Verifications ---

  async insertWorldIdVerification(params: InsertWorldIdVerificationParams): Promise<WorldIdVerificationRecord> {
    const expiresAt = params.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const res = this.db.prepare(`
      INSERT INTO world_id_verifications (token_id, account_id, check_kind, status, action, expected_signal, proof_json, proof_hash, expires_at)
      VALUES (?, ?, ?, 'PENDING', ?, ?, ?, ?, ?)
    `).run(params.tokenId, params.accountId, params.check, params.action, params.expectedSignal, params.proofJson ?? null, params.proofHash ?? null, expiresAt);

    const row = this.db.prepare("SELECT * FROM world_id_verifications WHERE id = ?").get(res.lastInsertRowid) as any;
    return this.mapWorldIdVerification(row);
  }

  async getWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
    const row = this.db.prepare("SELECT * FROM world_id_verifications WHERE id = ?").get(id) as any;
    return row ? this.mapWorldIdVerification(row) : null;
  }

  async findWorldIdVerificationByAction(
    tokenId: string,
    accountId: string,
    checkKind: string,
    action: string
  ): Promise<WorldIdVerificationRecord | null> {
    const row = this.db.prepare(`
      SELECT * FROM world_id_verifications
      WHERE token_id = ? AND account_id = ? AND check_kind = ? AND action = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(tokenId, accountId, checkKind, action) as any;
    return row ? this.mapWorldIdVerification(row) : null;
  }

  async findWorldIdVerificationByProofHash(proofHash: string): Promise<WorldIdVerificationRecord | null> {
    const row = this.db.prepare("SELECT * FROM world_id_verifications WHERE proof_hash = ?").get(proofHash) as any;
    return row ? this.mapWorldIdVerification(row) : null;
  }

  async findWorldIdVerificationByNullifier(
    tokenId: string,
    checkKind: string,
    nullifierHash: string,
    accountId?: string
  ): Promise<WorldIdVerificationRecord | null> {
    if (accountId) {
      const row = this.db.prepare(`
        SELECT * FROM world_id_verifications
        WHERE token_id = ? AND check_kind = ? AND nullifier_hash = ? AND account_id = ?
        LIMIT 1
      `).get(tokenId, checkKind, nullifierHash, accountId) as any;
      return row ? this.mapWorldIdVerification(row) : null;
    }
    const row = this.db.prepare(`
      SELECT * FROM world_id_verifications
      WHERE token_id = ? AND check_kind = ? AND nullifier_hash = ?
      LIMIT 1
    `).get(tokenId, checkKind, nullifierHash) as any;
    return row ? this.mapWorldIdVerification(row) : null;
  }

  async updateWorldIdVerification(id: number, patch: UpdateWorldIdVerificationPatch): Promise<WorldIdVerificationRecord | null> {
    const assignments: string[] = [];
    const values: any[] = [];

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
        assignments.push(`${col} = ?`);
        values.push((patch as any)[key]);
      }
    }

    if (assignments.length === 0) return this.getWorldIdVerification(id);
    assignments.push("updated_at = datetime('now')");
    values.push(id);

    const query = `UPDATE world_id_verifications SET ${assignments.join(", ")} WHERE id = ?`;
    this.db.prepare(query).run(...values);
    return this.getWorldIdVerification(id);
  }

  async claimWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
    const result = this.db
      .prepare(
        `UPDATE world_id_verifications
         SET status = 'PROCESSING', error_code = NULL, error_detail = NULL,
             updated_at = datetime('now')
         WHERE id = ? AND status IN ('PENDING', 'FAILED') AND proof_json IS NOT NULL`
      )
      .run(id);
    return result.changes === 1 ? this.getWorldIdVerification(id) : null;
  }

  async completeWorldIdVerification(
    id: number,
    credential: string,
    nullifierHash: string,
    verifiedAt: string
  ): Promise<WorldIdCompletionResult> {
    return this.db.transaction((): WorldIdCompletionResult => {
      const current = this.db
        .prepare(
          `SELECT token_id, account_id, check_kind, action, proof_hash
           FROM world_id_verifications WHERE id = ?`
        )
        .get(id) as {
          token_id: string;
          account_id: string;
          check_kind: string;
          action: string;
          proof_hash: string | null;
        } | undefined;
      if (!current) {
        return { completed: false, code: "verification_missing", message: "Verification not found." };
      }

      const reject = (code: string, message: string): WorldIdCompletionResult => {
        this.db.prepare(
          `UPDATE world_id_verifications
           SET status = 'REJECTED', proof_json = NULL, error_code = ?, error_detail = ?,
               updated_at = datetime('now')
           WHERE id = ?`
        ).run(code, message, id);
        return { completed: false, code, message };
      };

      if (current.proof_hash) {
        const proofReplay = this.db
          .prepare(
            `SELECT id FROM world_id_verifications
             WHERE proof_hash = ? AND id != ? AND status IN ('VERIFIED', 'REJECTED') LIMIT 1`
          )
          .get(current.proof_hash, id) as { id: number } | undefined;
        if (proofReplay) {
          return reject("proof_replayed", "This exact World ID proof was already submitted.");
        }
      }

      const identityClaim = this.db
        .prepare(
          `SELECT id FROM world_id_verifications
           WHERE token_id = ? AND check_kind = ? AND action = ? AND nullifier_hash = ?
             AND account_id != ? AND status = 'VERIFIED' LIMIT 1`
        )
        .get(
          current.token_id,
          current.check_kind,
          current.action,
          nullifierHash,
          current.account_id
        ) as { id: number } | undefined;
      if (identityClaim) {
        return reject(
          "identity_already_claimed",
          "This World ID is already linked to another wallet for this token."
        );
      }

      const result = this.db.prepare(
        `UPDATE world_id_verifications
         SET status = 'VERIFIED', proof_json = NULL, credential = ?, nullifier_hash = ?,
             error_code = NULL, error_detail = NULL, verified_at = ?,
             updated_at = datetime('now')
         WHERE id = ? AND status = 'PROCESSING'`
      ).run(credential, nullifierHash, verifiedAt, id);

      return result.changes === 1
        ? { completed: true }
        : {
            completed: false,
            code: "verification_not_processing",
            message: "This World ID verification is no longer processing.",
          };
    })();
  }

  async failWorldIdVerification(
    id: number,
    errorCode: string,
    errorDetail: string,
    definitive: boolean
  ): Promise<WorldIdVerificationRecord | null> {
    this.db
      .prepare(
        `UPDATE world_id_verifications
         SET status = ?, proof_json = CASE WHEN ? THEN NULL ELSE proof_json END,
             error_code = ?, error_detail = ?, updated_at = datetime('now')
         WHERE id = ?`
      )
      .run(definitive ? "REJECTED" : "FAILED", definitive ? 1 : 0, errorCode, errorDetail, id);
    return this.getWorldIdVerification(id);
  }

  async getWorldIdVerificationProof(id: number): Promise<{
    verification: WorldIdVerificationRecord;
    proof: unknown;
  } | null> {
    const row = this.db.prepare("SELECT * FROM world_id_verifications WHERE id = ?").get(id) as any;
    if (!row) return null;
    const verification = this.mapWorldIdVerification(row);
    if (!row.proof_json) return { verification, proof: null };
    return { verification, proof: JSON.parse(row.proof_json) as unknown };
  }

  async listWorldIdVerifications(filters: {
    status?: WorldIdVerificationStatus;
    tokenId?: string;
    accountId?: string;
  } = {}): Promise<WorldIdVerificationRecord[]> {
    const clauses: string[] = [];
    const values: any[] = [];
    if (filters.status) {
      clauses.push("status = ?");
      values.push(filters.status);
    }
    if (filters.tokenId) {
      clauses.push("token_id = ?");
      values.push(filters.tokenId);
    }
    if (filters.accountId) {
      clauses.push("account_id = ?");
      values.push(filters.accountId);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const rows = this.db
      .prepare(`SELECT * FROM world_id_verifications ${where} ORDER BY created_at ASC, id ASC`)
      .all(...values) as any[];
    return rows.map((r) => this.mapWorldIdVerification(r));
  }

  async getLatestWorldIdVerification(
    tokenId: string,
    accountId: string,
    check: WorldIdCheckKind
  ): Promise<WorldIdVerificationRecord | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM world_id_verifications
         WHERE token_id = ? AND account_id = ? AND check_kind = ?
         ORDER BY id DESC LIMIT 1`
      )
      .get(tokenId, accountId, check) as any;
    return row ? this.mapWorldIdVerification(row) : null;
  }

  // --- Auth Sessions & Nonces ---

  async createAuthNonce(address: string): Promise<string> {
    const nonce = randomUUID();
    const now = Date.now();
    const expiresAt = now + 300_000;
    this.db.prepare(
      "INSERT INTO auth_nonces (nonce, address, consumed, issued_at, expires_at) VALUES (?, ?, 0, ?, ?)"
    ).run(nonce, address.toLowerCase(), now, expiresAt);
    return nonce;
  }

  async consumeAuthNonce(nonce: string, address: string): Promise<boolean> {
    const now = Date.now();
    const info = this.db.prepare(
      "UPDATE auth_nonces SET consumed = 1 WHERE nonce = ? AND address = ? AND consumed = 0 AND expires_at >= ?"
    ).run(nonce, address.toLowerCase(), now);
    return info.changes > 0;
  }

  async createAuthSession(params: CreateAuthSessionParams): Promise<string> {
    const id = randomUUID();
    const now = Date.now();
    this.db.prepare(`
      INSERT INTO auth_sessions (id, address, role, issued_at, expires_at, revoked, user_agent, ip)
      VALUES (?, ?, ?, ?, ?, 0, ?, ?)
    `).run(id, params.address.toLowerCase(), params.role, now, params.expiresAt, params.userAgent ?? null, params.ip ?? null);
    return id;
  }

  async getAuthSession(sessionId: string): Promise<AuthSessionRecord | null> {
    const row = this.db.prepare("SELECT * FROM auth_sessions WHERE id = ?").get(sessionId) as any;
    if (!row) return null;
    return {
      id: row.id,
      address: row.address,
      role: row.role,
      issuedAt: Number(row.issued_at),
      expiresAt: Number(row.expires_at),
      revoked: Boolean(row.revoked),
      userAgent: row.user_agent,
      ip: row.ip,
    };
  }

  async revokeAuthSession(sessionId: string): Promise<void> {
    this.db.prepare("UPDATE auth_sessions SET revoked = 1 WHERE id = ?").run(sessionId);
  }

  // --- Agent Sessions, Nonces & Spend ---

  async saveAgentSession(session: AgentSessionRecord): Promise<void> {
    this.db.prepare(`
      INSERT INTO agent_sessions (
        id, grantor, agent_address, validator_contract, max_spend_hbar, max_flow_monthly_usd,
        allowed_actions, chain_id, nonce, expires_at, signature, signature_type,
        spent_hbar, active_streams, status, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(grantor, nonce) DO UPDATE SET
        id = excluded.id,
        agent_address = excluded.agent_address,
        validator_contract = excluded.validator_contract,
        max_spend_hbar = excluded.max_spend_hbar,
        max_flow_monthly_usd = excluded.max_flow_monthly_usd,
        allowed_actions = excluded.allowed_actions,
        chain_id = excluded.chain_id,
        expires_at = excluded.expires_at,
        signature = excluded.signature,
        signature_type = excluded.signature_type,
        spent_hbar = excluded.spent_hbar,
        active_streams = excluded.active_streams,
        status = excluded.status,
        created_at = excluded.created_at
    `).run(
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
      session.createdAt ?? Date.now()
    );
  }

  async getAgentSession(id: string): Promise<AgentSessionRecord | null> {
    const row = this.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(id) as any;
    return row ? this.mapAgentSession(row) : null;
  }

  async getActiveAgentSession(grantor: string): Promise<AgentSessionRecord | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM agent_sessions
         WHERE grantor = ? AND status = 'ACTIVE' AND expires_at > ?
         ORDER BY created_at DESC LIMIT 1`
      )
      .get(grantor.toLowerCase(), Date.now()) as any;
    return row ? this.mapAgentSession(row) : null;
  }

  async getAgentSessionByGrantor(grantor: string, nonce: number): Promise<AgentSessionRecord | null> {
    const row = this.db.prepare(
      "SELECT * FROM agent_sessions WHERE grantor = ? AND nonce = ?"
    ).get(grantor.toLowerCase(), nonce) as any;
    return row ? this.mapAgentSession(row) : null;
  }

  async updateAgentSessionStatus(sessionId: string, status: string): Promise<void> {
    this.db.prepare("UPDATE agent_sessions SET status = ? WHERE id = ?").run(status, sessionId);
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
    return this.db.transaction(() => {
      const row = this.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(sessionId) as any;
      if (!row) {
        return { allowed: false, reason: "Session key record not found.", remainingHbar: 0, session: null };
      }
      const session = this.mapAgentSession(row);
      if (session.status !== "ACTIVE") {
        return { allowed: false, reason: `Session key is ${session.status}. Re-authorization required.`, remainingHbar: 0, session };
      }
      if (Date.now() > session.expiresAt) {
        this.db.prepare("UPDATE agent_sessions SET status = 'EXPIRED' WHERE id = ?").run(sessionId);
        session.status = "EXPIRED";
        return { allowed: false, reason: "Session key has expired. Re-authorization required.", remainingHbar: 0, session };
      }
      if (!session.allowedActions.includes(action)) {
        return {
          allowed: false,
          reason: `Cryptographic Policy Violation: Action '${action}' is not in delegated allowlist.`,
          remainingHbar: Math.max(0, session.maxSpendHbar - (session.spentHbar ?? 0)),
          session,
        };
      }
      const remaining = session.maxSpendHbar - (session.spentHbar ?? 0);
      if (spendHbar > 0 && spendHbar > remaining) {
        return {
          allowed: false,
          reason: `Budget Cap Exceeded: Requested ${spendHbar} HBAR exceeds remaining allowance (${remaining.toFixed(2)} HBAR).`,
          remainingHbar: remaining,
          session,
        };
      }
      if (flowRateMonthly > 0 && flowRateMonthly > session.maxFlowMonthlyUsd) {
        return {
          allowed: false,
          reason: `Yield Ceiling Violation: Requested monthly stream of $${flowRateMonthly} exceeds permitted maximum of $${session.maxFlowMonthlyUsd}.`,
          remainingHbar: remaining,
          session,
        };
      }
      const nonceRow = this.db
        .prepare("SELECT nonce FROM agent_nonces WHERE session_id = ? AND nonce = ?")
        .get(sessionId, requestNonce);
      if (nonceRow) {
        return {
          allowed: false,
          reason: "Request nonce already used. Replay detected and rejected.",
          remainingHbar: remaining,
          session,
        };
      }
      this.db
        .prepare("INSERT INTO agent_nonces (session_id, nonce, used_at) VALUES (?, ?, ?)")
        .run(sessionId, requestNonce, Date.now());
      if (spendHbar > 0) {
        this.db.prepare("UPDATE agent_sessions SET spent_hbar = spent_hbar + ? WHERE id = ?").run(spendHbar, sessionId);
        this.db
          .prepare("INSERT INTO agent_spend_log (session_id, action, spend_hbar, timestamp) VALUES (?, ?, ?, ?)")
          .run(sessionId, action, spendHbar, Date.now());
      }
      const updatedRow = this.db.prepare("SELECT * FROM agent_sessions WHERE id = ?").get(sessionId) as any;
      const updatedSession = this.mapAgentSession(updatedRow);
      return {
        allowed: true,
        remainingHbar: Math.max(0, updatedSession.maxSpendHbar - (updatedSession.spentHbar ?? 0)),
        session: updatedSession,
      };
    })();
  }

  async consumeAgentNonce(sessionId: string, nonce: string): Promise<boolean> {
    try {
      this.db.prepare(
        "INSERT INTO agent_nonces (session_id, nonce, used_at) VALUES (?, ?, ?)"
      ).run(sessionId, nonce, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  async recordAgentSpend(sessionId: string, action: string, amountHbar: number): Promise<void> {
    this.db.transaction(() => {
      this.db.prepare("UPDATE agent_sessions SET spent_hbar = spent_hbar + ? WHERE id = ?").run(amountHbar, sessionId);
      this.db.prepare("INSERT INTO agent_spend_log (session_id, action, spend_hbar, timestamp) VALUES (?, ?, ?, ?)").run(
        sessionId,
        action,
        amountHbar,
        Date.now()
      );
    })();
  }

  async consumeAgentRequestNonce(nonce: string, expiresAt: number): Promise<boolean> {
    try {
      this.db.prepare(
        "INSERT INTO agent_request_nonces (nonce, expires_at, consumed_at) VALUES (?, ?, ?)"
      ).run(nonce, expiresAt, Date.now());
      return true;
    } catch {
      return false;
    }
  }

  async purgeExpiredAgentRequestNonces(now = Date.now()): Promise<number> {
    const info = this.db.prepare("DELETE FROM agent_request_nonces WHERE expires_at < ?").run(now);
    return info.changes;
  }

  // --- Outbox Queue ---

  async enqueueOutboxJob(params: EnqueueOutboxParams): Promise<OutboxJobRecord> {
    const now = Date.now();
    const payloadStr = JSON.stringify(params.payload);

    if (params.idempotencyKey) {
      const existing = await this.getOutboxJobByIdempotencyKey(params.idempotencyKey);
      if (existing) return existing;
    }

    const res = this.db.prepare(`
      INSERT INTO outbox (type, payload, status, idempotency_key, created_at, updated_at)
      VALUES (?, ?, 'PENDING', ?, ?, ?)
    `).run(params.type, payloadStr, params.idempotencyKey ?? null, now, now);

    const row = this.db.prepare("SELECT * FROM outbox WHERE id = ?").get(res.lastInsertRowid) as any;
    return this.mapOutbox(row);
  }

  async claimPendingOutboxJobs(limit = 10): Promise<OutboxJobRecord[]> {
    const now = Date.now();
    let claimedRows: any[] = [];
    this.db.transaction(() => {
      const rows = this.db.prepare(`
        SELECT * FROM outbox
        WHERE status = 'PENDING'
        ORDER BY created_at ASC
        LIMIT ?
      `).all(limit) as any[];

      if (rows.length === 0) return;

      const ids = rows.map((r) => r.id);
      this.db.prepare(`
        UPDATE outbox
        SET status = 'PROCESSING', attempts = attempts + 1, updated_at = ?
        WHERE id IN (${ids.map(() => "?").join(",")})
      `).run(now, ...ids);

      claimedRows = this.db.prepare(`
        SELECT * FROM outbox
        WHERE id IN (${ids.map(() => "?").join(",")})
      `).all(...ids) as any[];
    })();

    return claimedRows.map((r) => this.mapOutbox(r));
  }

  async completeOutboxJob(id: number, result?: Record<string, unknown>): Promise<void> {
    const now = Date.now();
    this.db.prepare(
      "UPDATE outbox SET status = 'COMPLETED', result = ?, updated_at = ? WHERE id = ?"
    ).run(result ? JSON.stringify(result) : null, now, id);
  }

  async failOutboxJob(id: number, error: string, maxAttempts = 5): Promise<void> {
    const now = Date.now();
    const row = this.db.prepare("SELECT attempts FROM outbox WHERE id = ?").get(id) as any;
    const attempts = (row?.attempts ?? 0) + 1;
    const finalStatus = attempts >= maxAttempts ? "FAILED" : "PENDING";

    this.db.prepare(
      "UPDATE outbox SET status = ?, attempts = ?, last_error = ?, updated_at = ? WHERE id = ?"
    ).run(finalStatus, attempts, error, now, id);
  }

  async getOutboxJobByIdempotencyKey(key: string): Promise<OutboxJobRecord | null> {
    const row = this.db.prepare("SELECT * FROM outbox WHERE idempotency_key = ?").get(key) as any;
    return row ? this.mapOutbox(row) : null;
  }

  // --- Audit Logs ---

  async insertAuditLog(event: AuditEvent): Promise<void> {
    this.db.prepare(`
      INSERT INTO audit_log (actor, role, action, resource, status, detail, ip, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(
      event.actor,
      event.role,
      event.action,
      event.resource,
      event.status,
      event.detail ? JSON.stringify(event.detail) : null,
      event.ip ?? null
    );
  }

  async listAuditLogs(limit = 100): Promise<AuditLogRow[]> {
    return this.db.prepare("SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?").all(limit) as AuditLogRow[];
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
      createdAt: String(row.created_at),
    };
  }

  private mapHolder(row: any, token: TokenRecord): HolderRecord {
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

    const selfieRow = this.db
      .prepare(
        `SELECT * FROM world_id_verifications
         WHERE token_id = ? AND account_id = ? AND check_kind = 'selfie'
         ORDER BY id DESC LIMIT 1`
      )
      .get(row.token_id, row.account_id) as any;
    const identityRow = this.db
      .prepare(
        `SELECT * FROM world_id_verifications
         WHERE token_id = ? AND account_id = ? AND check_kind = 'identity'
         ORDER BY id DESC LIMIT 1`
      )
      .get(row.token_id, row.account_id) as any;

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
      worldIdSelfieVerification: selfieRow ? this.mapWorldIdVerification(selfieRow) : null,
      worldIdIdentityVerification: identityRow ? this.mapWorldIdVerification(identityRow) : null,
      lastCheckinAt,
      livenessState,
      activeScheduleId: row.active_schedule_id,
      activeScheduleExpiresAt: row.active_schedule_expires_at,
      livenessReclaimStatus: (row.liveness_reclaim_status as LivenessReclaimStatus) ?? "IDLE",
      livenessReclaimError: row.liveness_reclaim_error,
      livenessReclaimAttemptedAt: row.liveness_reclaim_attempted_at,
      status: row.status as HolderStatus,
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
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
      createdAt: String(row.created_at),
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
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
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
      createdAt: String(row.created_at),
      updatedAt: String(row.updated_at),
      expiresAt: String(row.expires_at),
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
