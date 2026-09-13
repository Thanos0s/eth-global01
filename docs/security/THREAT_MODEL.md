# Prism 8 Threat Model (STRIDE Methodology)

## 1. Scope & Objective
This document assesses security threats to Prism 8 across its web platform, smart contracts, cryptographic session delegation, and off-chain execution agents.

---

## 2. STRIDE Threat Analysis & Mitigations

### 2.1 Spoofing (Identity & Origin)
* **Threat S1: Unauthorized user calls operator treasury endpoints.**
  * *Impact*: Unauthorized minting of fractional shares, unauthorized pausing of contracts, or rogue cap-table modifications.
  * *Mitigation*: All mutation endpoints (`/api/tokens`, `/api/evm/tokens`, `/api/tokens/[id]/pause`, `/api/tokens/[id]/holders/*`) enforce `requireOperator`. Operators must sign a cryptographic challenge nonce using an EVM address present in the server's immutable `OPERATOR_ADDRESSES` allowlist.
* **Threat S2: Impersonation of autonomous agent.**
  * *Impact*: Bypassing user-delegated spending bounds or triggering unauthorized payouts.
  * *Mitigation*: Agent endpoints require a constant-time verified shared secret (`x-tokenization-agent-secret`), an HMAC-SHA256 signature calculated over the secret, timestamp, and unique nonce, and a strict timestamp window (±120s).
* **Threat S3: User specifies arbitrary investor recipient on yield claims.**
  * *Impact*: An investor claims yield intended for another wallet.
  * *Mitigation*: `/api/yield/claim` ignores any client-supplied `accountId`. The payout recipient is derived strictly from the authenticated session context (`ctx.address`).
* **Threat S4: Investor registers, requests tokens, or modifies allowance/verification on behalf of another wallet.**
  * *Impact*: Unauthorized modification of another investor's holder record, token requests, or allowance state.
  * *Mitigation*: All holder endpoints (`/holders`, `/requests`, `/allowance`, `/worldid-verify`, `/worldid-retry`) call `requireInvestor(req, accountId)`. For investors, the account is derived from or strictly matched against `ctx.address`. Cross-account mutations are rejected with `403 Forbidden`.
* **Threat S5: Replay of internal agent HTTP requests.**
  * *Impact*: An attacker intercepting an internal agent webhook or MCP request attempts to replay execution.
  * *Mitigation*: `requireAgentRequest` stores one-time request nonces into `agent_request_nonces` with a unique constraint and TTL. Replayed nonces are rejected with `409 Conflict`. Timestamps outside ±120s are rejected with `401 Unauthorized`.

### 2.2 Tampering (Data Integrity)
* **Threat T1: Client supplies fabricated on-chain transaction IDs or compliance states.**
  * *Impact*: Platform displays false proof of compliance or fraudulent settlement receipts.
  * *Mitigation*: Client input is never accepted as authoritative for compliance or settlement. Transactions are broadcast directly by the platform or validated via verified Hedera Mirror Node and EVM RPC calls.
* **Threat T2: Tampering with EIP-712 session policy parameters.**
  * *Impact*: Agent executes outside of the grantor's intended budget or duration.
  * *Mitigation*: Exact EIP-712 typed data hashing (`verifyTypedData`). Any alteration to `maxSpendHbar`, `maxFlowMonthlyUsd`, `allowedActions`, `validUntil`, `chainId`, or `nonce` invalidates the signature and causes immediate rejection.
* **Threat T3: Database tampering or unauthorized state modification.**
  * *Impact*: Inconsistent cap table or altered holder KYC status.
  * *Mitigation*: State transitions emit structured audit entries in the `audit_log` table with the actor's authenticated address and timestamp.

### 2.3 Repudiation (Auditability)
* **Threat R1: Denying execution of sensitive actions (e.g., token freeze, reclamation).**
  * *Impact*: Inability to prove who initiated a freeze or clawback.
  * *Mitigation*: All operator actions and agent spend deductions are permanently recorded with actor identity, IP address, and payload metadata in `audit_log` and anchored to the Hedera Consensus Service (HCS).

### 2.4 Information Disclosure (Confidentiality)
* **Threat I1: Exposure of raw World ID zero-knowledge proof payloads or user identity.**
  * *Impact*: Privacy violation and potential tracking of physical identity.
  * *Mitigation*: Only the nullifier hash and verification status are persisted. Raw proof payloads (`proof_json`) are cleared immediately after verification and excluded from all repository read queries.
* **Threat I2: Server-side secret leakage in API error messages or logs.**
  * *Impact*: Compromise of `HEDERA_OPERATOR_KEY`, `EVM_OPERATOR_PRIVATE_KEY`, or `TOKENIZATION_AGENT_SECRET`.
  * *Mitigation*: Global `handleRoute` catches all errors and returns sanitized messages (`ApiError`). Stack traces and internal configurations are suppressed in production.

### 2.5 Denial of Service (Availability)
* **Threat D1: API flooding on computational endpoints (e.g., signature verification, token creation).**
  * *Impact*: Server exhaustion and denial of service for genuine investors.
  * *Mitigation*: Sliding-window rate limiter enforces a cap of 100 requests/minute per client IP on all mutation routes.
* **Threat D2: Oversized JSON payload memory exhaustion.**
  * *Impact*: Node.js process out-of-memory crash.
  * *Mitigation*: Body parser inspects `Content-Length` and rejects any payload exceeding 64 KB (`413 Payload Too Large`).
* **Threat D3: Unbounded gas loops in smart contracts.**
  * *Impact*: `YieldVault.emergencyFreezeAll` running out of gas on large cap tables.
  * *Mitigation*: Contract refactored to use `emergencyFreezeBatch(bytes32 propertyId, address[] calldata investors)` allowing chunked execution.

### 2.6 Elevation of Privilege (Access Control)
* **Threat E1: Investor escalating privileges to operator.**
  * *Impact*: Modifying cap tables, whitelisting unauthorized accounts.
  * *Mitigation*: Role assignment is strictly determined server-side by checking the verified wallet address against `OPERATOR_ADDRESSES`. No client header or cookie can dictate role elevation.
* **Threat E2: Replay of spent EIP-712 session allowances.**
  * *Impact*: Agent draining more funds than authorized by the user.
  * *Mitigation*: Per-grantor policy nonces (`UNIQUE(grantor, nonce)`) and per-request UUID tracking in `agent_nonces` executed atomically inside database transactions.
* **Threat E3: Rogue agent bypassing session policy constraints directly on-chain.**
  * *Impact*: Agent invokes unauthorized contracts or function selectors, drains value, or executes past expiration.
  * *Mitigation*: `SessionKeyValidator.sol` implements strict ERC-7579/ERC-4337 validation in `validateUserOp`. It decodes `callData`, verifies target against `allowedTargets`, verifies function selector against `allowedSelectors`, recovers agent signature over `userOpHash`, verifies grantor EIP-712 signature over the policy, checks chain ID and expiration, and tracks cumulative spend per policy nonce directly on-chain (`policySpend`).

