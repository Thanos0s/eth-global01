import { getDbAdapter } from "./index";
import type {
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
} from "./types";
import type {
  TokenRecord,
  HolderRecord,
  EventRecord,
  TokenRequestRecord,
  WorldIdVerificationRecord,
  TokenRequestStatus,
  WorldIdCheckKind,
  WorldIdVerificationStatus,
} from "@/types";

export type {
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
};

// --- Tokens ---

export async function insertToken(params: InsertTokenParams): Promise<TokenRecord> {
  return getDbAdapter().insertToken(params);
}

export async function getToken(id: string): Promise<TokenRecord | null> {
  return getDbAdapter().getToken(id);
}

export async function listTokens(): Promise<TokenRecord[]> {
  return getDbAdapter().listTokens();
}

export async function setTokenPaused(id: string, paused: boolean): Promise<TokenRecord | null> {
  return getDbAdapter().setTokenPaused(id, paused);
}

// --- Holders ---

export async function ensureHolder(tokenId: string, accountId: string, evmAddress?: string | null): Promise<HolderRecord> {
  return getDbAdapter().ensureHolder(tokenId, accountId, evmAddress);
}

export async function getHolder(tokenId: string, accountId: string): Promise<HolderRecord | null> {
  return getDbAdapter().getHolder(tokenId, accountId);
}

export async function listHolders(tokenId: string): Promise<HolderRecord[]> {
  return getDbAdapter().listHolders(tokenId);
}

export async function updateHolder(tokenId: string, accountId: string, patch: UpdateHolderPatch): Promise<HolderRecord | null> {
  return getDbAdapter().updateHolder(tokenId, accountId, patch);
}

export async function listHoldersDueForLivenessCheck(): Promise<HolderRecord[]> {
  return getDbAdapter().listHoldersDueForLivenessCheck();
}

export async function claimLivenessReclaim(tokenId: string, accountId: string): Promise<boolean> {
  return getDbAdapter().claimLivenessReclaim(tokenId, accountId);
}

// --- Events ---

export async function insertEvent(params: InsertEventParams): Promise<EventRecord> {
  return getDbAdapter().insertEvent(params);
}

export async function listEvents(tokenId: string, limit = 100): Promise<EventRecord[]> {
  return getDbAdapter().listEvents(tokenId, limit);
}

// --- Token Requests ---

export async function upsertTokenRequest(params: UpsertTokenRequestParams): Promise<TokenRequestRecord> {
  return getDbAdapter().upsertTokenRequest(params);
}

export async function getTokenRequest(id: number): Promise<TokenRequestRecord | null> {
  return getDbAdapter().getTokenRequest(id);
}

export async function getTokenRequestForHolder(tokenId: string, accountId: string): Promise<TokenRequestRecord | null> {
  return getDbAdapter().getTokenRequestForHolder(tokenId, accountId);
}

export async function listTokenRequestsForToken(tokenId: string): Promise<TokenRequestRecord[]> {
  return getDbAdapter().listTokenRequestsForToken(tokenId);
}

export async function listTokenRequests(status?: TokenRequestStatus): Promise<TokenRequestRecord[]> {
  return getDbAdapter().listTokenRequests(status);
}

export async function updateTokenRequest(id: number, patch: UpdateTokenRequestPatch): Promise<TokenRequestRecord | null> {
  return getDbAdapter().updateTokenRequest(id, patch);
}

export async function createOrReopenTokenRequest(
  tokenId: string,
  accountId: string,
  amountBaseUnits: string
): Promise<{ request: TokenRequestRecord; started: boolean; created: boolean }> {
  return getDbAdapter().createOrReopenTokenRequest(tokenId, accountId, amountBaseUnits);
}

export async function claimTokenRequest(id: number): Promise<TokenRequestRecord | null> {
  return getDbAdapter().claimTokenRequest(id);
}

export async function rejectPendingTokenRequest(id: number, reason: string): Promise<TokenRequestRecord | null> {
  return getDbAdapter().rejectPendingTokenRequest(id, reason);
}

// --- World ID Verifications ---

export async function insertWorldIdVerification(params: InsertWorldIdVerificationParams): Promise<WorldIdVerificationRecord> {
  return getDbAdapter().insertWorldIdVerification(params);
}
export const createWorldIdVerification = insertWorldIdVerification;

export async function getWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().getWorldIdVerification(id);
}

export async function findWorldIdVerificationByAction(
  tokenId: string,
  accountId: string,
  checkKind: string,
  action: string
): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().findWorldIdVerificationByAction(tokenId, accountId, checkKind, action);
}

export async function findWorldIdVerificationByProofHash(proofHash: string): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().findWorldIdVerificationByProofHash(proofHash);
}

export async function findWorldIdVerificationByNullifier(
  tokenId: string,
  checkKind: string,
  nullifierHash: string,
  accountId?: string
): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().findWorldIdVerificationByNullifier(tokenId, checkKind, nullifierHash, accountId);
}

export async function updateWorldIdVerification(id: number, patch: UpdateWorldIdVerificationPatch): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().updateWorldIdVerification(id, patch);
}

export async function claimWorldIdVerification(id: number): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().claimWorldIdVerification(id);
}

export async function completeWorldIdVerification(
  id: number,
  credential: string,
  nullifierHash: string,
  verifiedAt: string
): Promise<WorldIdCompletionResult> {
  return getDbAdapter().completeWorldIdVerification(id, credential, nullifierHash, verifiedAt);
}

export async function failWorldIdVerification(
  id: number,
  errorCode: string,
  errorDetail: string,
  definitive: boolean
): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().failWorldIdVerification(id, errorCode, errorDetail, definitive);
}

export async function getWorldIdVerificationProof(id: number): Promise<{
  verification: WorldIdVerificationRecord;
  proof: unknown;
} | null> {
  return getDbAdapter().getWorldIdVerificationProof(id);
}

export async function listWorldIdVerifications(filters?: {
  status?: WorldIdVerificationStatus;
  tokenId?: string;
  accountId?: string;
}): Promise<WorldIdVerificationRecord[]> {
  return getDbAdapter().listWorldIdVerifications(filters);
}

export async function getLatestWorldIdVerification(
  tokenId: string,
  accountId: string,
  check: WorldIdCheckKind
): Promise<WorldIdVerificationRecord | null> {
  return getDbAdapter().getLatestWorldIdVerification(tokenId, accountId, check);
}

// --- Auth Sessions & Nonces ---

export async function createAuthNonce(address: string): Promise<string> {
  return getDbAdapter().createAuthNonce(address);
}

export async function consumeAuthNonce(nonce: string, address: string): Promise<boolean> {
  return getDbAdapter().consumeAuthNonce(nonce, address);
}

export async function createAuthSession(params: CreateAuthSessionParams): Promise<string> {
  return getDbAdapter().createAuthSession(params);
}

export async function getAuthSession(sessionId: string): Promise<AuthSessionRecord | null> {
  return getDbAdapter().getAuthSession(sessionId);
}

export async function revokeAuthSession(sessionId: string): Promise<void> {
  return getDbAdapter().revokeAuthSession(sessionId);
}

// --- Agent Sessions, Nonces & Spend ---

export async function saveAgentSession(session: AgentSessionRecord): Promise<void> {
  return getDbAdapter().saveAgentSession(session);
}

export async function getAgentSession(id: string): Promise<AgentSessionRecord | null> {
  return getDbAdapter().getAgentSession(id);
}

export async function getActiveAgentSession(grantor: string): Promise<AgentSessionRecord | null> {
  return getDbAdapter().getActiveAgentSession(grantor);
}

export async function getAgentSessionByGrantor(grantor: string, nonce: number): Promise<AgentSessionRecord | null> {
  return getDbAdapter().getAgentSessionByGrantor(grantor, nonce);
}

export async function updateAgentSessionStatus(sessionId: string, status: string): Promise<void> {
  return getDbAdapter().updateAgentSessionStatus(sessionId, status);
}

export async function validateAndSpendAgentSession(
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
  return getDbAdapter().validateAndSpendAgentSession(
    sessionId,
    action,
    spendHbar,
    flowRateMonthly,
    requestNonce
  );
}

export async function consumeAgentNonce(sessionId: string, nonce: string): Promise<boolean> {
  return getDbAdapter().consumeAgentNonce(sessionId, nonce);
}

export async function recordAgentSpend(sessionId: string, action: string, amountHbar: number): Promise<void> {
  return getDbAdapter().recordAgentSpend(sessionId, action, amountHbar);
}

export async function consumeAgentRequestNonce(nonce: string, expiresAt: number): Promise<boolean> {
  return getDbAdapter().consumeAgentRequestNonce(nonce, expiresAt);
}

export async function purgeExpiredAgentRequestNonces(now?: number): Promise<number> {
  return getDbAdapter().purgeExpiredAgentRequestNonces(now);
}

// --- Outbox Queue ---

export async function enqueueOutboxJob(params: EnqueueOutboxParams): Promise<OutboxJobRecord> {
  return getDbAdapter().enqueueOutboxJob(params);
}

export async function claimPendingOutboxJobs(limit = 10): Promise<OutboxJobRecord[]> {
  return getDbAdapter().claimPendingOutboxJobs(limit);
}

export async function completeOutboxJob(id: number, result?: Record<string, unknown>): Promise<void> {
  return getDbAdapter().completeOutboxJob(id, result);
}

export async function failOutboxJob(id: number, error: string, maxAttempts = 5): Promise<void> {
  return getDbAdapter().failOutboxJob(id, error, maxAttempts);
}

export async function getOutboxJobByIdempotencyKey(key: string): Promise<OutboxJobRecord | null> {
  return getDbAdapter().getOutboxJobByIdempotencyKey(key);
}
