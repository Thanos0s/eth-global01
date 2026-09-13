# Prism 8 Security Architecture

## 1. System Overview & Trust Boundaries

Prism 8 operates across three primary trust domains:
1. **Client / Browser Domain (Untrusted)**: Public visitors, unauthenticated users, and authenticated investors connecting via web3 wallets.
2. **Platform Application Server (Trusted)**: Next.js 16 runtime running API routes, business logic, session policy enforcement, and database transactions.
3. **External Decentralized Infrastructure (Consensus / State)**: Hedera Hashgraph (HTS & HCS), EVM Networks (Ethereum Sepolia & Base Sepolia), Superfluid protocol, and The Graph indexing nodes.

```
+-----------------------------------------------------------------------+
|                       Untrusted Client Domain                         |
|  [Public Browser]       [Verified Investor]       [Operator / Admin]  |
+-----------------------------------------------------------------------+
                                    | (HTTPS / WSS)
                                    v
+-----------------------------------------------------------------------+
|                  Prism 8 Platform Server (Trusted)                    |
|  +-----------------------------------------------------------------+  |
|  |                API Gateway & Middleware Layer                   |  |
|  |  - Rate Limiting (100 req/min/IP)   - Body Size Guard (64 KB)   |  |
|  |  - CSRF / SameSite Cookies         - Timing-Safe HMAC Auth     |  |
|  |  - Role-Based Access Control (RBAC: Public/Investor/Operator)   |  |
|  +-----------------------------------------------------------------+  |
|                                   |                                   |
|  +--------------------------------+--------------------------------+  |
|  | Core Execution & Validation Engine                              |  |
|  |  - EIP-712 ERC-7579 Session Policy (Atomic spend, replay-proof) |  |
|  |  - Invariant Solvency Engine (YieldVault reserve accounting)    |  |
|  |  - Outbox Pattern (Idempotent durable chain writes)             |  |
|  |  - Structured Audit Ledger (actor, role, action, resource)     |  |
|  +-----------------------------------------------------------------+  |
|                                   |                                   |
|                         [SQLite / PostgreSQL]                         |
+-----------------------------------------------------------------------+
                                    |
          +-------------------------+-------------------------+
          | (RPC / REST)            | (RPC)                   | (GraphQL)
          v                         v                         v
+--------------------+    +--------------------+    +--------------------+
|  Hedera Hashgraph  |    |  EVM Base/Sepolia  |    |     The Graph      |
|  - HTS Tokens      |    |  - YieldVault      |    |  - Subgraph Index  |
|  - HCS Audit Topic |    |  - Superfluid CFA  |    |  - Holders & Flows |
+--------------------+    +--------------------+    +--------------------+
```

---

## 2. Roles & Authorization Model

| Role | Identifier | Authentication Mechanism | Permissions |
| :--- | :--- | :--- | :--- |
| **Public** | `anonymous` | None required | Read-only catalog queries, token metadata, public health check. |
| **Investor** | `investor` | Cryptographic wallet challenge + signed personal_sign nonce (`prism8_session` httpOnly cookie or Bearer token) | Own-account token association, own-account liveness checkin, own-account yield claim, World ID credential submission for own address. Cannot act on behalf of other accounts. |
| **Operator / Issuer** | `operator` | Wallet challenge + signed nonce verified against server `OPERATOR_ADDRESSES` allowlist | Token creation, EVM token deployment, pausing/unpausing, cap-table whitelisting/revocation, asset reclamation, Superfluid stream creation/cancellation, rent ingestion. |
| **Internal Agent** | `agent` | Server-to-server header authentication: constant-time shared secret (`x-tokenization-agent-secret`) + timestamp window (±120s) + unique nonce + HMAC-SHA256 signature | Automated pipeline execution under delegated EIP-712 session envelope, scheduled liveness sweeps, automated token transfers within allowance. |

---

## 3. Endpoint Authorization Matrix

| Method | Endpoint | Allowed Roles | Enforced Constraints |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/tokens` | Public, Investor, Operator, Agent | Read-only |
| `POST` | `/api/tokens` | **Operator** | Requires authenticated operator wallet. Server supplies treasury ID. |
| `POST` | `/api/evm/tokens` | **Operator** | Requires authenticated operator wallet. |
| `POST` | `/api/tokens/[id]/pause` | **Operator** | Requires operator role. |
| `POST` | `/api/tokens/[id]/holders/[acct]/whitelist` | **Operator** | Whitelists target account. |
| `POST` | `/api/tokens/[id]/holders/[acct]/revoke` | **Operator** | Revokes target account. |
| `POST` | `/api/tokens/[id]/holders/[acct]/reclaim-noncompliance` | **Operator** | Non-compliance asset clawback. |
| `POST` | `/api/token-requests/[id]/fulfill` | **Operator** | Approves token grant request. |
| `POST` | `/api/token-requests/[id]/reject` | **Operator** | Rejects token grant request. |
| `POST` | `/api/yield/streams` | **Operator** | Creates/modifies Superfluid stream with solvency check. |
| `POST` | `/api/rent/simulate` | **Operator** | Ingests verified tenant rent. |
| `POST` | `/api/agent/session` | **Investor, Operator** | Requires EIP-712 signature over exact policy parameters. |
| `POST` | `/api/agent/execute` | **Operator, Agent** | Requires valid unexpired session, within budget cap, replay-nonce validated. |
| `POST` | `/api/yield/claim` | **Investor** | `accountId` strictly derived from session; client cannot dictate recipient. |
| `POST` | `/api/tokens/[id]/holders/[acct]/associate` | **Investor** | `acct` must match authenticated session address. |
| `POST` | `/api/tokens/[id]/holders/[acct]/checkin` | **Investor** | `acct` must match authenticated session address. |
| `POST` | `/api/worldid/verify-selfie` | **Investor** | Account ID bound to authenticated wallet. |
| `POST` | `/api/worldid/verify-identity` | **Investor** | Account ID bound to authenticated wallet. |
| `POST` | `/api/tokens/[id]/transfer` | **Agent** | Mandatory HMAC + nonce + timestamp validation. |
| `POST` | `/api/tokens/[id]/holders/[acct]/allowance` | **Agent** | Mandatory HMAC + nonce + timestamp validation. |
| `POST` | `/api/liveness/process` | **Agent** | Mandatory HMAC + nonce + timestamp validation. |

---

## 4. Cryptographic Session Key Enforcement (ERC-7579 Scoped Agent)

1. **EIP-712 Domain & Type Binding**:
   - `name`: `Prism8SessionKey`
   - `version`: `1`
   - `chainId`: Strictly bound to active chain (Base Sepolia `84532` or Hedera).
   - `verifyingContract`: Deployed `SessionKeyValidator` address.
   - `types`: `SessionPolicy(address grantor, address agent, address validatorContract, uint256 maxSpendHbar, uint256 maxFlowMonthlyUsd, string allowedActions, uint256 validUntil, uint256 chainId, uint256 nonce)`.
2. **Persistent Storage & Replay Prevention**:
   - Persisted in database table `agent_sessions` with `UNIQUE(grantor, nonce)`.
   - Per-request UUID nonces recorded in `agent_nonces`.
3. **Atomic Spend Accounting**:
   - Execution validation and spend commitment occur in a single database transaction (`db.transaction`).
   - If requested spend exceeds `max_spend_hbar - spent_hbar`, execution is rejected with `403`.
4. **Permanent Revocation**:
   - Revocation updates `status = 'REVOKED'`. Revoked sessions can never be re-activated.
5. **No Demo Fallbacks**:
   - The insecure `PRE_AUTHORIZED` demo session and signature length checks (>50 characters) are permanently eliminated.

---

## 5. Demo Mode Isolation (`DEMO_MODE`)

1. `DEMO_MODE=false` by default in all environments.
2. In production (`NODE_ENV=production`), setting `DEMO_MODE=true` is rejected during boot validation.
3. When `DEMO_MODE=true` is explicitly configured in local/test environments:
   - All simulated responses return `_demo: true` and `_notice: "⚠️ Simulated — not on-chain"`.
   - Real private keys (`HEDERA_OPERATOR_KEY`, `EVM_OPERATOR_PRIVATE_KEY`) must not be configured in demo mode.
   - Production API mutation endpoints fail closed if live external services are unavailable rather than returning fabricated hashes.
