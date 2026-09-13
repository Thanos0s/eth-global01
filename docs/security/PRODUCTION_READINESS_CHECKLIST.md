# Prism 8 Production Readiness Checklist & Deployment Gate

## 1. Executive Summary
This document serves as the formal readiness audit and gate for moving Prism 8 from testnet / demo staging into a live mainnet production environment with real capital.

---

## 2. Controls Implemented in this Refactor (Production Hardened)

### Security & Access Control
- [x] **Role-Based Authorization Model**: Explicitly segregated roles (`public`, `investor`, `operator`, `internal agent`).
- [x] **Operator Route Guarding**: All treasury and contract mutation routes (`/api/tokens`, `/api/evm/tokens`, `/api/tokens/[id]/pause`, `/api/tokens/[id]/holders/*`, `/api/yield/streams`, `/api/rent/simulate`) protected by `requireOperator` verifying cryptographic wallet signatures against an immutable server allowlist (`OPERATOR_ADDRESSES`).
- [x] **Investor Scope Enforcement**: Investor mutation endpoints (`/api/yield/claim`, `/api/tokens/[id]/holders/[acct]/associate`) strictly derive the recipient account from the authenticated session context (`ctx.address`), preventing spoofed claimant parameters.
- [x] **Internal Agent Authentication**: Constant-time comparison on shared secrets (`TOKENIZATION_AGENT_SECRET`), with timestamp freshness window (±120 seconds) and HMAC-SHA256 signature verification.
- [x] **Rate Limiting & Payload Bounds**: Enforced 100 requests/minute per IP sliding window on mutations, and strict 64 KB JSON body size caps (`413 Payload Too Large`).
- [x] **Audit Ledger**: Structured audit logging table (`audit_log`) in SQLite permanently recording actor, role, action, resource, IP, and timestamp for all mutations.

### Cryptographic Session Policies (Hermes Agent)
- [x] **Persistent EIP-712 Session Storage**: In-memory maps eliminated; sessions persisted in `agent_sessions` SQLite table.
- [x] **Zero Fallback**: Hardcoded pre-authorized demo session (`0x70997970C518...`) and signature length checks (>50 chars) permanently removed.
- [x] **Strict Domain Binding**: EIP-712 domain and type hash validation matching ERC-7579 modular account delegation.
- [x] **Atomic Budget Accounting & Anti-Replay**: Spend deduction and per-request UUID tracking executed inside synchronous database transactions (`db.transaction()`).
- [x] **Irrevocable Revocation**: `revokeSession` permanently flags sessions as `REVOKED`.

### Demo Mode Isolation
- [x] **Explicit Demo Gate**: `DEMO_MODE=false` by default. Local simulation returns visible disclaimer banner: `"⚠️ Simulated — not on-chain"`.
- [x] **No Fabricated Data in Live Paths**: Removed hardcoded transaction hashes (`0.0.90-1789066142...`, `0x1e0d77de7d53...`). Production endpoints fail closed or return verifiable pending states when networks are unreachable.
- [x] **Boot Validation**: Node process fails closed at startup if required production secrets are missing while `DEMO_MODE !== 'true'`.

### Smart Contracts Hardening
- [x] **Reserve Solvency Invariant**: `YieldVault.sol` tracks `totalObligatedPerSec` and reverts with `InsufficientReserve` if total monthly obligations would exceed deposited rental reserves.
- [x] **Batched Emergency Freeze**: Replaced unbounded storage array loops in `emergencyFreezeAll` with `emergencyFreezeBatch(propertyId, investors)` to prevent gas bombs.
- [x] **OpenZeppelin Access Control**: Migrated single-owner pattern to `AccessControl` (`OPERATOR_ROLE`, `PAUSER_ROLE`, `DEFAULT_ADMIN_ROLE`).
- [x] **Safe Downcasting**: Verified uint96 flow rate conversions against int96 overflow bounds.
- [x] **Compliance Events & Clawbacks**: `CompliantRwaToken.sol` emits `ApprovalUpdated`, `FreezeUpdated`, and `RecoveryExecuted` events with NatSpec documentation and a legal disclaimer.
- [x] **ERC-7579/ERC-4337 Session Key Enforcement**: Upgraded `SessionKeyValidator.sol` with real UserOp calldata decoding, target and selector whitelisting, on-chain spend tracking per policy nonce (`policySpend`), grantor EIP-712 signature recovery, and session key `userOpHash` verification without demo fallbacks.

### Pass 2 Production Hardening
- [x] **Holder-Scoped Mutation Route Guarding**: Protected all holder mutation endpoints (`/holders`, `/requests`, `/allowance`, `/worldid-verify`, `/worldid-retry`) with `requireInvestor(req, accountId)`. Rejects unauthenticated calls with 401 and cross-account actions with 403 while permitting operators.
- [x] **Durable Agent Nonce Replay Store**: Persistent database table `agent_request_nonces` with TTL and unique constraints; atomic consumption in `requireAgentRequest` rejecting replay attacks with 409 and expired timestamps with 401.
- [x] **Elimination of Fake Production Data**: Removed random mirror node and RPC transaction sampling in `agent/execute/route.ts`; gated mock holders and transfers in `subgraph/route.ts` strictly under `isDemoMode()`; failed closed on HCS audit errors in live mode.
- [x] **Production PostgreSQL Persistence Abstraction**: Implemented connection-pooled PostgreSQL adapter (`postgres.ts`) with automated migrations, fail-closed boot validation when `DATABASE_URL` is missing in production, and health check monitoring with dialect reporting.
- [x] **Test Script Modernization**: Repaired `test-contracts.mjs` (batched freeze) and `test-subgraph.mjs` (dynamic queries); added npm script aliases (`test:unit`, `test:integration`, `test:contracts`, `test:all`).

### Pass 3 Final Production Hardening (Universal PostgreSQL & Full ERC-7579 Verification)
- [x] **Universal PostgreSQL Production Database Backend**: Created `IDatabaseAdapter` async abstraction powering 100% of repository operations across all domain entities (tokens, holders, events, token requests, World ID verifications, auth sessions/nonces, agent sessions/nonces/spend, outbox jobs, audit logs).
- [x] **Fail-Closed Production Boot Validation**: Strict verification requiring `DATABASE_URL` or `POSTGRES_URL` in production; throws unrecoverable startup error with zero silent fallback to SQLite.
- [x] **Automated Database Migrations**: Added transactional schema migrations for PostgreSQL at boot and dedicated CLI runner (`npm run db:migrate`). Verified via `pg-mem` integration suite.
- [x] **Zero Synthetic Hedera Fallback**: Replaced all fake token creation with `HederaConfigurationError` outside non-production demo mode; stripped synthetic transaction IDs from rent simulation and yield claiming.
- [x] **ERC-7579 / ERC-4337 Smart Account Binding & Verification**: Restricted `SessionKeyValidator.sol` caller validation to `msg.sender == userOp.sender`, eliminated wildcards, rejected ERC-7579 batch execution (`CALLTYPE_BATCH`), verified via 16 deployed behavioral integration tests covering valid execution, spend caps, expiration, and adversarial vectors.
- [x] **End-to-End Verification Pipeline**: 100% passing across all 76 Vitest tests, 5 smart contract behavioral test suites, 18 Subgraph assertions, clean TypeScript typecheck (`tsc --noEmit`), ESLint compliance, and Next.js 16 production build.

### Resilience & Durability
- [x] **Idempotent Outbox Pattern**: PostgreSQL and SQLite `outbox` table with `idempotency_key` preventing duplicate chain submissions.
- [x] **Readiness & Health Endpoint**: `/api/health` checking database (reporting dialect and latency), Hedera mirror node, and EVM RPC latency with 3-second timeouts.
- [x] **Automated CI & Test Suites**: 11 Vitest suites (76 passing unit/integration tests), contract ABI and behavioral verification (16 tests), and Next.js 16 production build.

---

## 3. External Blockers & Requirements for Real-Money Mainnet

Do NOT claim the platform is ready for mainnet real-estate tokenization until the following external requirements are fulfilled:

### 3.1 Legal & Regulatory Compliance
- [ ] **Securities Counsel Opinion**: Formal legal sign-off on the fractionalized asset structure under applicable jurisdictions (e.g., US SEC Reg D / Reg S, or EU MiCA compliant whitepaper).
- [ ] **Property Title Anchoring**: Legal custody / SPV (Special Purpose Vehicle) deed recording matching on-chain tokenized supply.
- [ ] **KYC/AML Legal Sufficiency**: Legal review of whether World ID zero-knowledge selfie/identity attestations meet FINRA/FinCEN or equivalent jurisdiction requirements.

### 3.2 Key Custody & Treasury Infrastructure
- [ ] **Hardware Security Modules (HSM) / MPC**: Migrate `HEDERA_OPERATOR_KEY` and `EVM_OPERATOR_PRIVATE_KEY` out of `.env` files into Fireblocks, AWS KMS, or Safe multi-sig.
- [ ] **Multi-Signature Governance**: Multi-sig ownership (e.g., Gnosis Safe) for `DEFAULT_ADMIN_ROLE` on `YieldVault` and `CompliantRwaToken`.

### 3.3 Smart Contract & Security Audits
- [ ] **Independent Third-Party Audit**: Formal audit by a recognized blockchain security firm (e.g., OpenZeppelin, Spearbit, Trail of Bits) of `YieldVault.sol`, `CompliantRwaToken.sol`, and `SessionKeyValidator.sol`.
- [ ] **External Mainnet EntryPoint Deployment**: Deploy and verify canonical ERC-4337 EntryPoint (0x0000000071727De22E5E9d8BAf0edAc6f37da032) integration on Base Mainnet.

### 3.4 Operational & Cloud Infrastructure
- [x] **Database Abstraction & PostgreSQL Backend**: Implemented async PostgreSQL pool adapter with migration scripts ready for managed PostgreSQL cluster (e.g. Railway Postgres or AWS RDS).
- [ ] **Dedicated RPC Providers**: Replace public RPC endpoints (`sepolia.base.org`, public testnet mirror node) with SLA-backed infrastructure (Alchemy, QuickNode, or Hedera Portal).
- [ ] **Production Superfluid Facilitator**: Deploy and register approved Superfluid token wrappers on Base Mainnet.
