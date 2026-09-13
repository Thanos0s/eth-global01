import { Pool, type PoolConfig } from "pg";

declare global {
  var __postgresPool: Pool | undefined;
}

export const POSTGRES_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tokens (
  id                        TEXT PRIMARY KEY,
  blockchain                TEXT NOT NULL DEFAULT 'HEDERA',
  network                   TEXT NOT NULL DEFAULT 'testnet',
  name                      TEXT NOT NULL,
  symbol                    TEXT NOT NULL,
  token_type                TEXT NOT NULL,
  decimals                  INTEGER NOT NULL DEFAULT 0,
  initial_supply            TEXT NOT NULL DEFAULT '0',
  supply_type               TEXT NOT NULL,
  max_supply                TEXT,
  treasury_account_id       TEXT NOT NULL,
  asset_category            TEXT,
  memo                      TEXT,
  kyc_required              BOOLEAN NOT NULL DEFAULT FALSE,
  freeze_default            BOOLEAN NOT NULL DEFAULT FALSE,
  wipe_enabled               BOOLEAN NOT NULL DEFAULT FALSE,
  pause_enabled              BOOLEAN NOT NULL DEFAULT FALSE,
  world_id_required          BOOLEAN NOT NULL DEFAULT FALSE,
  world_id_selfie_check      BOOLEAN NOT NULL DEFAULT FALSE,
  world_id_minimum_age       INTEGER,
  world_id_nationality       TEXT,
  liveness_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  liveness_period_seconds    INTEGER,
  custom_fee_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
  custom_fee_config          TEXT,
  has_admin_key               BOOLEAN NOT NULL DEFAULT FALSE,
  has_kyc_key                 BOOLEAN NOT NULL DEFAULT FALSE,
  has_freeze_key              BOOLEAN NOT NULL DEFAULT FALSE,
  has_wipe_key                BOOLEAN NOT NULL DEFAULT FALSE,
  has_pause_key               BOOLEAN NOT NULL DEFAULT FALSE,
  has_supply_key              BOOLEAN NOT NULL DEFAULT FALSE,
  has_fee_schedule_key        BOOLEAN NOT NULL DEFAULT FALSE,
  paused                    BOOLEAN NOT NULL DEFAULT FALSE,
  create_tx_id               TEXT,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS holders (
  token_id                    TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  account_id                  TEXT NOT NULL,
  evm_address                 TEXT,
  associated                  BOOLEAN NOT NULL DEFAULT FALSE,
  kyc_granted                 BOOLEAN NOT NULL DEFAULT FALSE,
  frozen                      BOOLEAN NOT NULL DEFAULT FALSE,
  allowance_granted           BOOLEAN NOT NULL DEFAULT FALSE,
  world_id_verified_at         TEXT,
  world_id_selfie_verified_at  TEXT,
  world_id_identity_verified_at TEXT,
  last_checkin_at             TEXT,
  active_schedule_id          TEXT,
  active_schedule_expires_at   TEXT,
  liveness_reclaim_status      TEXT NOT NULL DEFAULT 'IDLE',
  liveness_reclaim_error       TEXT,
  liveness_reclaim_attempted_at TEXT,
  status                      TEXT NOT NULL DEFAULT 'PENDING',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (token_id, account_id)
);

CREATE TABLE IF NOT EXISTS events (
  id            SERIAL PRIMARY KEY,
  token_id      TEXT NOT NULL,
  account_id    TEXT,
  type          TEXT NOT NULL,
  detail        TEXT,
  tx_id         TEXT,
  hashscan_url  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS token_requests (
  id                       SERIAL PRIMARY KEY,
  token_id                 TEXT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  account_id               TEXT NOT NULL,
  amount_base_units        TEXT NOT NULL,
  status                   TEXT NOT NULL DEFAULT 'PENDING',
  trigger_status           TEXT NOT NULL DEFAULT 'NOT_TRIGGERED',
  trigger_error            TEXT,
  processing_error         TEXT,
  rejection_reason         TEXT,
  fulfillment_tx_id        TEXT,
  fulfillment_hashscan_url TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (token_id, account_id)
);

CREATE TABLE IF NOT EXISTS world_id_verifications (
  id                SERIAL PRIMARY KEY,
  token_id          TEXT NOT NULL,
  account_id        TEXT NOT NULL,
  check_kind        TEXT NOT NULL,
  status            TEXT NOT NULL DEFAULT 'PENDING',
  action            TEXT NOT NULL,
  expected_signal   TEXT NOT NULL,
  proof_json        TEXT,
  proof_hash        TEXT,
  credential        TEXT,
  nullifier_hash    TEXT,
  error_code        TEXT,
  error_detail      TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes'),
  verified_at       TEXT,
  FOREIGN KEY (token_id, account_id) REFERENCES holders(token_id, account_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id          TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  role        TEXT NOT NULL,
  issued_at   BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL,
  revoked     BOOLEAN NOT NULL DEFAULT FALSE,
  user_agent  TEXT,
  ip          TEXT
);

CREATE TABLE IF NOT EXISTS auth_nonces (
  nonce       TEXT PRIMARY KEY,
  address     TEXT NOT NULL,
  consumed    BOOLEAN NOT NULL DEFAULT FALSE,
  issued_at   BIGINT NOT NULL,
  expires_at  BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_log (
  id         SERIAL PRIMARY KEY,
  actor      TEXT NOT NULL,
  role       TEXT NOT NULL,
  action     TEXT NOT NULL,
  resource   TEXT NOT NULL,
  status     TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_sessions (
  id                    TEXT PRIMARY KEY,
  grantor               TEXT NOT NULL,
  agent_address         TEXT NOT NULL,
  validator_contract    TEXT NOT NULL,
  max_spend_hbar        DOUBLE PRECISION NOT NULL,
  max_flow_monthly_usd  DOUBLE PRECISION NOT NULL,
  allowed_actions       TEXT NOT NULL,
  chain_id              BIGINT NOT NULL,
  nonce                 BIGINT NOT NULL,
  expires_at            BIGINT NOT NULL,
  signature             TEXT NOT NULL,
  signature_type        TEXT NOT NULL DEFAULT 'EIP712',
  spent_hbar            DOUBLE PRECISION NOT NULL DEFAULT 0,
  active_streams        INTEGER NOT NULL DEFAULT 0,
  status                TEXT NOT NULL DEFAULT 'ACTIVE',
  created_at            BIGINT NOT NULL,
  UNIQUE (grantor, nonce)
);

CREATE TABLE IF NOT EXISTS agent_nonces (
  session_id  TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  nonce       TEXT NOT NULL,
  used_at     BIGINT NOT NULL,
  PRIMARY KEY (session_id, nonce)
);

CREATE TABLE IF NOT EXISTS agent_spend_log (
  id          SERIAL PRIMARY KEY,
  session_id  TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  spend_hbar  DOUBLE PRECISION NOT NULL,
  timestamp   BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS outbox (
  id              SERIAL PRIMARY KEY,
  type            TEXT NOT NULL,
  payload         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'PENDING',
  attempts        INTEGER NOT NULL DEFAULT 0,
  last_error      TEXT,
  idempotency_key TEXT UNIQUE,
  result          TEXT,
  created_at      BIGINT NOT NULL,
  updated_at      BIGINT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_request_nonces (
  nonce       TEXT PRIMARY KEY,
  expires_at  BIGINT NOT NULL,
  consumed_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pg_holders_token ON holders(token_id);
CREATE INDEX IF NOT EXISTS idx_pg_events_token ON events(token_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_token_requests_status ON token_requests(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pg_auth_sessions_address ON auth_sessions(address, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_auth_nonces_address ON auth_nonces(address, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_agent_sessions_grantor ON agent_sessions(grantor, expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_pg_outbox_status ON outbox(status, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_pg_agent_request_nonces_expires ON agent_request_nonces(expires_at);
`;

export function getPostgresPool(): Pool | null {
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!connectionString) return null;

  if (global.__postgresPool) {
    return global.__postgresPool;
  }

  const isProduction = process.env.NODE_ENV === "production";
  const config: PoolConfig = {
    connectionString,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    ssl: connectionString.includes("sslmode=require") || isProduction
      ? { rejectUnauthorized: false }
      : undefined,
  };

  const pool = new Pool(config);
  pool.on("error", (err) => {
    console.error("[PostgreSQL Pool Error]", err);
  });

  global.__postgresPool = pool;
  return pool;
}

export async function migratePostgres(pool: Pool): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const statements = POSTGRES_SCHEMA_SQL.split(";")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    for (const stmt of statements) {
      await client.query(stmt);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function checkPostgresHealth(pool?: Pool): Promise<{
  ok: boolean;
  latencyMs: number;
  error?: string;
}> {
  const targetPool = pool ?? getPostgresPool();
  if (!targetPool) {
    return { ok: false, latencyMs: 0, error: "PostgreSQL pool is not configured" };
  }

  const start = Date.now();
  try {
    const res = await targetPool.query("SELECT 1 AS alive");
    const latencyMs = Date.now() - start;
    const ok = res.rows.length > 0 && res.rows[0].alive === 1;
    return { ok, latencyMs };
  } catch (err: any) {
    return { ok: false, latencyMs: Date.now() - start, error: err.message };
  }
}
