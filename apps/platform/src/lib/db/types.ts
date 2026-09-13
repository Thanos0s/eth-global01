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
  ComplianceOptions,
  CustomFeeConfig,
  TokenRequestStatus,
  HermesTriggerStatus,
  HolderStatus,
  LivenessReclaimStatus,
  WorldIdCheckKind,
  WorldIdVerificationStatus,
} from "@/types";
import type { AuditEvent } from "../audit/logger";

export interface InsertTokenParams {
  id: string;
  blockchain?: Blockchain;
  network?: TokenNetwork;
  name: string;
  symbol: string;
  tokenType: TokenType;
  decimals: number;
  initialSupply: number;
  supplyType: SupplyType;
  maxSupply?: number;
  treasuryAccountId: string;
  assetCategory: AssetCategory;
  memo?: string;
  compliance: ComplianceOptions;
  customFee: CustomFeeConfig | null;
  keys: TokenRecord["keys"];
  createTxId: string;
}

export interface UpdateHolderPatch {
  evmAddress?: string | null;
  associated?: boolean;
  kycGranted?: boolean;
  frozen?: boolean;
  allowanceGranted?: boolean;
  worldIdVerifiedAt?: string | null;
  worldIdSelfieVerifiedAt?: string | null;
  worldIdIdentityVerifiedAt?: string | null;
  lastCheckinAt?: string | null;
  activeScheduleId?: string | null;
  activeScheduleExpiresAt?: string | null;
  livenessReclaimStatus?: LivenessReclaimStatus;
  livenessReclaimError?: string | null;
  livenessReclaimAttemptedAt?: string | null;
  status?: HolderStatus;
}

export interface InsertEventParams {
  tokenId: string;
  accountId?: string | null;
  type: string;
  detail?: Record<string, unknown> | string | null;
  txId?: string | null;
  hashscanUrl?: string | null;
}

export interface UpsertTokenRequestParams {
  tokenId: string;
  accountId: string;
  amountBaseUnits: string;
}

export interface UpdateTokenRequestPatch {
  status?: TokenRequestStatus;
  triggerStatus?: HermesTriggerStatus;
  triggerError?: string | null;
  processingError?: string | null;
  rejectionReason?: string | null;
  fulfillmentTxId?: string | null;
  fulfillmentHashscanUrl?: string | null;
}

export interface InsertWorldIdVerificationParams {
  tokenId: string;
  accountId: string;
  check: WorldIdCheckKind;
  action: string;
  expectedSignal: string;
  proofJson?: string | null;
  proofHash?: string | null;
  expiresAt?: string;
}

export interface UpdateWorldIdVerificationPatch {
  status?: WorldIdVerificationStatus;
  proofJson?: string | null;
  proofHash?: string | null;
  credential?: string | null;
  nullifierHash?: string | null;
  errorCode?: string | null;
  errorDetail?: string | null;
  verifiedAt?: string | null;
}

export type WorldIdCompletionResult =
  | { completed: true }
  | { completed: false; code: string; message: string };

export interface CreateAuthSessionParams {
  address: string;
  role: string;
  expiresAt: number;
  userAgent?: string;
  ip?: string;
}

export interface AuthSessionRecord {
  id: string;
  address: string;
  role: string;
  issuedAt: number;
  expiresAt: number;
  revoked: boolean;
  userAgent?: string | null;
  ip?: string | null;
}

export interface AgentSessionRecord {
  id: string;
  grantor: string;
  agentAddress: string;
  validatorContract: string;
  maxSpendHbar: number;
  maxFlowMonthlyUsd: number;
  allowedActions: string[];
  chainId: number;
  nonce: number;
  expiresAt: number;
  signature: string;
  signatureType: string;
  spentHbar?: number;
  activeStreams?: number;
  status?: string;
  createdAt?: number;
}

export interface OutboxJobRecord {
  id: number;
  type: string;
  payload: Record<string, unknown>;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  attempts: number;
  lastError: string | null;
  idempotencyKey: string | null;
  result: Record<string, unknown> | null;
  createdAt: number;
  updatedAt: number;
}

export interface EnqueueOutboxParams {
  type: string;
  payload: Record<string, unknown>;
  idempotencyKey?: string;
}

export interface AuditLogRow {
  id: number;
  actor: string;
  role: string;
  action: string;
  resource: string;
  status: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
}

export interface DatabaseHealthInfo {
  dialect: "postgres" | "sqlite";
  status: "ok" | "degraded";
  migrationStatus: "applied" | "pending";
  latencyMs: number;
  error?: string;
}

export interface IDatabaseAdapter {
  getDialect(): "postgres" | "sqlite";
  init(): Promise<void>;
  getHealth(): Promise<DatabaseHealthInfo>;

  // Tokens
  insertToken(params: InsertTokenParams): Promise<TokenRecord>;
  getToken(id: string): Promise<TokenRecord | null>;
  listTokens(): Promise<TokenRecord[]>;
  setTokenPaused(id: string, paused: boolean): Promise<TokenRecord | null>;

  // Holders
  ensureHolder(tokenId: string, accountId: string, evmAddress?: string | null): Promise<HolderRecord>;
  getHolder(tokenId: string, accountId: string): Promise<HolderRecord | null>;
  listHolders(tokenId: string): Promise<HolderRecord[]>;
  updateHolder(tokenId: string, accountId: string, patch: UpdateHolderPatch): Promise<HolderRecord | null>;
  listHoldersDueForLivenessCheck(): Promise<HolderRecord[]>;
  claimLivenessReclaim(tokenId: string, accountId: string): Promise<boolean>;

  // Events
  insertEvent(params: InsertEventParams): Promise<EventRecord>;
  listEvents(tokenId: string, limit?: number): Promise<EventRecord[]>;

  // Token Requests
  upsertTokenRequest(params: UpsertTokenRequestParams): Promise<TokenRequestRecord>;
  getTokenRequest(id: number): Promise<TokenRequestRecord | null>;
  getTokenRequestForHolder(tokenId: string, accountId: string): Promise<TokenRequestRecord | null>;
  listTokenRequestsForToken(tokenId: string): Promise<TokenRequestRecord[]>;
  listTokenRequests(status?: TokenRequestStatus): Promise<TokenRequestRecord[]>;
  updateTokenRequest(id: number, patch: UpdateTokenRequestPatch): Promise<TokenRequestRecord | null>;
  createOrReopenTokenRequest(tokenId: string, accountId: string, amountBaseUnits: string): Promise<{ request: TokenRequestRecord; started: boolean; created: boolean }>;
  claimTokenRequest(id: number): Promise<TokenRequestRecord | null>;
  rejectPendingTokenRequest(id: number, reason: string): Promise<TokenRequestRecord | null>;

  // World ID Verifications
  insertWorldIdVerification(params: InsertWorldIdVerificationParams): Promise<WorldIdVerificationRecord>;
  getWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null>;
  findWorldIdVerificationByAction(tokenId: string, accountId: string, checkKind: string, action: string): Promise<WorldIdVerificationRecord | null>;
  findWorldIdVerificationByProofHash(proofHash: string): Promise<WorldIdVerificationRecord | null>;
  findWorldIdVerificationByNullifier(tokenId: string, checkKind: string, nullifierHash: string, accountId?: string): Promise<WorldIdVerificationRecord | null>;
  updateWorldIdVerification(id: number, patch: UpdateWorldIdVerificationPatch): Promise<WorldIdVerificationRecord | null>;
  claimWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null>;
  completeWorldIdVerification(id: number, credential: string, nullifierHash: string, verifiedAt: string): Promise<WorldIdCompletionResult>;
  failWorldIdVerification(id: number, errorCode: string, errorDetail: string, definitive: boolean): Promise<WorldIdVerificationRecord | null>;
  getWorldIdVerificationProof(id: number): Promise<{ verification: WorldIdVerificationRecord; proof: unknown } | null>;
  listWorldIdVerifications(filters?: { status?: WorldIdVerificationStatus; tokenId?: string; accountId?: string; }): Promise<WorldIdVerificationRecord[]>;
  getLatestWorldIdVerification(tokenId: string, accountId: string, check: WorldIdCheckKind): Promise<WorldIdVerificationRecord | null>;

  // Auth Sessions & Nonces
  createAuthNonce(address: string): Promise<string>;
  consumeAuthNonce(nonce: string, address: string): Promise<boolean>;
  createAuthSession(params: CreateAuthSessionParams): Promise<string>;
  getAuthSession(sessionId: string): Promise<AuthSessionRecord | null>;
  revokeAuthSession(sessionId: string): Promise<void>;

  // Agent Sessions, Nonces & Spend
  saveAgentSession(session: AgentSessionRecord): Promise<void>;
  getAgentSession(id: string): Promise<AgentSessionRecord | null>;
  getActiveAgentSession(grantor: string): Promise<AgentSessionRecord | null>;
  getAgentSessionByGrantor(grantor: string, nonce: number): Promise<AgentSessionRecord | null>;
  updateAgentSessionStatus(sessionId: string, status: string): Promise<void>;
  consumeAgentNonce(sessionId: string, nonce: string): Promise<boolean>;
  recordAgentSpend(sessionId: string, action: string, amountHbar: number): Promise<void>;
  consumeAgentRequestNonce(nonce: string, expiresAt: number): Promise<boolean>;
  purgeExpiredAgentRequestNonces(now?: number): Promise<number>;
  validateAndSpendAgentSession(
    sessionId: string,
    action: string,
    spendHbar: number,
    flowRateMonthly: number,
    requestNonce: string
  ): Promise<{
    allowed: boolean;
    reason?: string;
    remainingHbar: number;
    session: AgentSessionRecord | null;
  }>;

  // Outbox Queue
  enqueueOutboxJob(params: EnqueueOutboxParams): Promise<OutboxJobRecord>;
  claimPendingOutboxJobs(limit?: number): Promise<OutboxJobRecord[]>;
  completeOutboxJob(id: number, result?: Record<string, unknown>): Promise<void>;
  failOutboxJob(id: number, error: string, maxAttempts?: number): Promise<void>;
  getOutboxJobByIdempotencyKey(key: string): Promise<OutboxJobRecord | null>;

  // Audit Logs
  insertAuditLog(event: AuditEvent): Promise<void>;
  listAuditLogs(limit?: number): Promise<AuditLogRow[]>;
}
