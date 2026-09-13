<!-- Logo / Banner placeholder: user will add later -->

# Prism 8 — Autonomous Real-Estate Yield Streaming Engine

**Prism 8** is a next-generation autonomous **Real-Estate Tokenization & Continuous Yield Streaming Engine**. It combines **Hedera x402** machine-to-machine payments, **Hedera Token Service (HTS)** fractionalization, **Superfluid CFA** per-second yield streaming on Base Sepolia, **The Graph** autonomous indexing & Model Context Protocol (MCP) tooling, and **USPS Chainlink Functions** physical address validation.

Built for **ETHGlobal 2026**:
* **Account Abstraction Track**: ERC-7579 Modular Session Keys & EIP-712 Scoped Policy Execution
* **Hedera Track**: Agentic Economy x402 Machine-to-Machine Challenge & HCS Consensus Audit
* **The Graph Track**: One AI Track, Two Ways to Build (Dual MCP + Autonomous Indexing)
* **Superfluid Track**: Real-time continuous cashflow & EVM yield streaming on Base Sepolia

---

## 🛡️ 0. Novelty Highlight: ERC-7579 Scoped Session Keys for AI Agents

The single biggest barrier to Web3 AI agents is custody risk: users must either surrender their private key or click "Confirm" on every micro-transaction.

Prism 8 solves this with **ERC-7579 Modular Account Abstraction with Scoped Session Keys**:
1. **EIP-712 Typed Signing in MetaMask**: The delegator signs an authentic structured session policy specifying an agent grantee (`0x8920...43e7`), a strict spend cap (`5.0 HBAR`), an action whitelist, and a 24-hour expiration.
2. **On-Chain Module Validation**: The [`SessionKeyValidator.sol`](apps/platform/contracts/modules/SessionKeyValidator.sol) module (`MODULE_TYPE_VALIDATOR = 1`) validates user operations and cryptographic signatures directly on-chain (`0x7579C0de00000000000000000000000000007579`).
3. **Agentic Mission Cockpit**: A real-time terminal UI where users grant session keys, Hermes executes 4-stage cross-chain missions autonomously, and an interactive "Test Guardrail" button proves that rogue agent actions are cryptographically intercepted with `HTTP 403 Forbidden`.

---

## ⚡ 1. Hedera x402 Machine-to-Machine Payment Rail (ETHGlobal Track Qualification)

The agentic economy requires payment rails that operate at machine speed: sub-second finality, predictable sub-cent fees, and native token operations without smart contract overhead.

Prism 8 provides an end-to-end, testnet-verifiable agentic payment rail:
1. **Agent Service Discovery**: Machine-readable directory published at `/.well-known/agent-services.json` and `/api/x402/directory` defining metered tiered pricing (`STANDARD_DPV`: 0.5 HBAR, `PREMIUM_DPV`: 1.0 HBAR) and Blocky402 facilitator routing.
2. **RFC Standards-Compliant x402 Payment Challenges**: Unpaid requests to `/api/x402/property-oracle` return `HTTP 402 Payment Required` with `WWW-Authenticate: x402 ...` challenge, `X-402-Invoice`, `X-402-Payee`, `X-402-Amount`, and `X-402-Expires` headers.
3. **Real On-Chain Settlement Verification**: Hedera Mirror Node verifier (`https://testnet.mirrornode.hedera.com/api/v1/transactions/{id}`) cryptographically validates consensus status (`SUCCESS`), recipient account, tinybar transfer amounts, and single-use invoice memo bindings.
4. **Replay & Double-Spend Protection**: Invoices are cryptographically bound to the query hash and single-use; subsequent requests with consumed invoices or reused transaction IDs are rejected with `HTTP 400 Bad Request`.
5. **Verifiable Payment Audit Trails on HCS**: Every settlement is anchored to a **Hedera Consensus Service (HCS) Topic** (`0.0.10522243`), creating an unforgeable, consensus-timestamped public audit log verifiable on HashScan.
6. **Autonomous Consuming Agent (Hermes)**: Hermes detects challenges, signs and broadcasts micropayments on Hedera testnet, and completes queries end-to-end with **zero human intervention**.

```bash
# Run the live Hedera Testnet x402 end-to-end verification script:
node scripts/verify-hedera-x402-live.mjs
```

---

## 📊 2. The Graph Track: "One AI track, two ways to build"

Prism 8 fulfills **both halves** of The Graph hackathon track plus the featured x402 payment challenge:

```
                            ┌──────────────────────────────────────┐
                            │    Hermes Autonomous AI Agent        │
                            └──────────────────┬───────────────────┘
                                               │
             ┌─────────────────────────────────┴────────────────────────────────┐
             │ (Model Context Protocol)                                         │ (Model Context Protocol)
             ▼                                                                  ▼
┌──────────────────────────────┐                                   ┌──────────────────────────────┐
│  subgraph_read MCP Server    │                                   │  subgraph_write MCP Server   │
│ - get_top_holders            │                                   │ - add_token_source           │
│ - get_token_info             │                                   │ - set_token_sources          │
│ - get_recent_transfers       │                                   │ - Auto `graph codegen`       │
│ - get_account_balance        │                                   │ - Auto `graph deploy` to     │
│ - get_deployment_status      │                                   │   Graph Studio               │
└──────────────┬───────────────┘                                   └──────────────┬───────────────┘
               │                                                                  │
               ▼ (GraphQL Queries)                                                ▼ (Automated Manifest Mutation)
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                               The Graph Studio (Sepolia Subgraph)                               │
│                         Entities: Token  •  Account  •  Transfer                                │
└──────────────────────────────────────────────┬──────────────────────────────────────────────────┘
                                               │
                                               ▼ (Live Shareholder Distribution)
                                ┌──────────────────────────────┐
                                │ Superfluid YieldVault.sol    │
                                │ (Continuous CFA Cashflows)   │
                                └──────────────────────────────┘
```

### Way 1: Tooling for AI Environments
* **Dual MCP Servers (`@modelcontextprotocol/sdk`)**:
  * [`apps/agent/mcps/subgraph/mcp-server/src/read.ts`](apps/agent/mcps/subgraph/mcp-server/src/read.ts) (**`subgraph_read`**): Equips LLM agents with 8 read-only tools to query on-chain indexed data in natural language (`get_token_info`, `get_top_holders`, `get_recent_transfers`, `get_account_balance`, `get_biggest_transfer`, `get_tracked_tokens`, `get_deployment_status`, `get_latest_sepolia_block`).
  * [`apps/agent/mcps/subgraph/mcp-server/src/write.ts`](apps/agent/mcps/subgraph/mcp-server/src/write.ts) (**`subgraph_write`**): Autonomous manifest mutation pipeline (`add_token_source`, `set_token_sources`) that dynamically rewrites `subgraph.yaml`, executes `graph codegen`, builds, and redeploys to Graph Studio using isolated `GRAPH_DEPLOY_KEY` credentials.
* **Full Documentation & Configs**: See [`apps/agent/mcps/subgraph/mcp-server/README.md`](apps/agent/mcps/subgraph/mcp-server/README.md) for Claude Desktop, Cursor, and Hermes setup JSONs.

### Way 2: AI Agent Using Live Blockchain Data (Load-Bearing Execution)
* **Autonomous Real-Estate Yield Allocation**: Hermes executes load-bearing GraphQL queries to discover token holders and balances, computing exact proportional cashflows and per-second Superfluid CFA flow rates:
  $$\text{holderShare} = \frac{\text{holderBalance}}{\text{totalEligibleBalance}}, \quad \text{flowRatePerSec} = \frac{\text{monthlyRentUsd} \times \text{holderShare}}{2,592,000}$$
* **Fail-Closed Indexing Health & Staleness Guards**: If `_meta.hasIndexingErrors == true` or block data is stale, Hermes halts downstream yield streaming rather than allocating on corrupt data.
* **Full Data Provenance Ledger**: Every allocation logs subgraph deployment IDs, indexed block numbers, timestamps, and query parameters.
* **The Graph AI Inspector**: Interactive modal on the storefront allowing judges to toggle Live Studio vs Demo modes, inspect `_meta` health, run live holder discovery, and audit data provenance.
* **Track Qualification Guide**: Full evidence dossier and Start Fresh declaration available at [`docs/THE_GRAPH_QUALIFICATION_EVIDENCE.md`](docs/THE_GRAPH_QUALIFICATION_EVIDENCE.md).

---

## 🌊 3. Continuous Real-Time Yield Streaming (Superfluid CFA)

Unlike traditional platforms that distribute rental yield once a month, Prism 8 streams cashflows **per-second**:
* Rental inflows are deposited into `YieldVault.sol` on Base Sepolia (wrapping stablecoins into `fUSDCx` Super Tokens).
* Continuous Flow Agreements (CFA) stream yield directly into fractional token holders' wallets every second:
  $$\text{flowRate} = \frac{\text{monthlyRentUsd} \times \text{investorShareRatio}}{2,592,000 \text{ seconds}}$$
* **Real-time Ticking Dashboard**: Storefront UI ticks every 80ms, visually rendering cashflow streaming continuously into the investor's balance.
* **Tenant Simulator**: One-click "Simulate Tenant Rent Payment" button injects rent payments and triggers dynamic flow-rate adjustments.

---

## 🏛️ Full System Architecture

```
                           ┌──────────────────────────────────────────────┐
                           │      Public Next.js Storefront & App         │
                           │  - Real-Estate Listing Form (USPS verified)  │
                           │  - Live Superfluid Yield Ticker Dashboard    │
                           │  - "The Graph AI Inspector" Modal            │
                           │  - "Simulate Tenant Rent Payment" Trigger    │
                           │  - World ID Verification Modal               │
                           └──────────────────────┬───────────────────────┘
                                                  │ (REST / Webhooks)
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │     Hermes Autonomous Operator Console       │
                           │  - Natural language property tokenization    │
                           │  - Mandatory USPS address check policy       │
                           │  - The Graph holder distribution discovery   │
                           │  - Automated per-second flow rate math       │
                           │  - Real-time stream management & freezing    │
                           └──────────────────────┬───────────────────────┘
                                                  │ (MCP Protocol)
                 ┌────────────────────────────────┼────────────────────────────────┐
                 ▼                                ▼                                ▼
      ┌─────────────────────┐          ┌─────────────────────┐          ┌─────────────────────┐
      │ usps_chainlink_mcp  │          │   superfluid_mcp    │          │  subgraph_read/write│
      │  (Address & x402)   │          │  (CFA Stream Mgmt)  │          │ (GraphQL & Deploy)  │
      └──────────┬──────────┘          └──────────┬──────────┘          └──────────┬──────────┘
                 │                                │                                │
                 ├────────────────────────┐       │                                │
                 ▼                        ▼       ▼                                ▼
┌──────────────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────────────────────────┐
│          Hedera Testnet          │ │      HCS Audit Topic      │ │        Base Sepolia / The Graph      │
│ - x402 Oracle Payment Settlement │ │ - Consensus timestamps    │ │ - PropertyRegistry.sol (Metadata)   │
│ - Native HTS Real-Estate Shares  │ │ - Publicly auditable on   │ │ - YieldVault.sol (Rent Staking)     │
│ - Scheduled Yield Transactions   │ │   HashScan                │ │ - Superfluid CFAv1 (fUSDCx Streams) │
│ - Blocky402 Facilitator          │ │                           │ │ - The Graph Studio Subgraph Indexer │
└──────────────────────────────────┘ └───────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🤖 Registered Hermes MCP Servers

Hermes is equipped with 6 specialized MCP servers:

1. **`usps_chainlink`** — Validates physical property addresses against USPS records, intercepts and settles x402 challenges on Hedera, and anchors verified hashes.
2. **`superfluid`** — Opens, updates, monitors, and freezes per-second CFA yield streams on Base Sepolia (`fUSDCx`).
3. **`subgraph_read`** — Queries indexed ERC-20 token distributions, holders, and transfer events via The Graph GraphQL API.
4. **`subgraph_write`** — Autonomously mutates `subgraph.yaml` and redeploys new property contracts to Graph Studio via CLI.
5. **`hedera`** — Deploys and manages fractional real-estate shares via native HTS with compliance controls.
6. **`worldid`** — Verifies investor identity and selfie proofs in the trusted backend.

---

## 🚀 Quickstart & Running Locally

### 1. Run the Platform & Contracts (Next.js)
```bash
cd apps/platform
cp .env.example .env
npm install
npm run compile:contracts
npm run dev
```
Open `http://localhost:3000` to view the storefront, live stream dashboard, The Graph AI Inspector, and rent simulator.

### 2. Run the Verification Test Suite
```bash
cd apps/platform

# Run all automated tests (Vitest 76 tests + contract verification + Subgraph)
npm run test:all

# Run specific test suites
npm run test:unit           # Core unit tests (contracts, rateLimit, outbox, sessionPolicy, auth)
npm run test:integration    # Route auth, agent replay prevention, session validator
npm run test:contracts      # Smart contract ABI & bytecode checks
npm run typecheck           # Strict TypeScript typechecking (tsc --noEmit)
npm run build               # Next.js 16 production build

# Protocol verification scripts
node scripts/verify-hedera-x402-live.mjs  # Live Hedera Testnet x402 + HCS audit proof
node scripts/test-x402-oracle.mjs         # x402 Oracle protocol & discovery check
node scripts/test-contracts.mjs           # Smart contract invariant check
node scripts/test-subgraph.mjs            # The Graph subgraph schema & MCP check
```

### 3. Deploy to Railway
Keep root directory at `/`. Railway builds `apps/agent/Dockerfile` with the whole repository as context, running Next.js, Hermes, and all MCP servers in a single unified container.

---

## 🎬 Hackathon Demo Script & Track Walkthrough
See [`docs/demo-script.md`](docs/demo-script.md) for the step-by-step judge walkthrough covering:
1. Agent service discovery at `/.well-known/agent-services.json`
2. Autonomous x402 micropayment on Hedera Testnet (0.5 HBAR)
3. USPS DPV delivery verification & HTS token minting
4. The Graph AI Inspector & live shareholder GraphQL discovery
5. Continuous Superfluid per-second yield streaming on Base Sepolia
6. HCS verifiable consensus audit trail on HashScan

---

## 🤖 AI Tools Attribution & Spec-Driven Development

In full compliance with ETHGlobal 2026 AI guidelines, all AI tool usage is transparently documented:
- **Full Attribution & Spec Record:** [`docs/AI_ATTRIBUTION_AND_SPEC.md`](docs/AI_ATTRIBUTION_AND_SPEC.md)
- **Tools Used:** Nous Research Hermes Agent (autonomous on-chain executor), Google Antigravity / DeepMind coding assistant (pair-programming, test coverage), Claude Code (MCP server interfaces), Cursor (TypeScript/Tailwind scaffolding).
- **Human Contributions:** System and multi-chain architecture, ERC-7579 session key security model, single-use invoice replay protection, USPS DPV normalization pipeline, and production deployment orchestration.
- **Spec-Driven Planning Artifacts:** [`docs/security/SECURITY_ARCHITECTURE.md`](docs/security/SECURITY_ARCHITECTURE.md), [`docs/security/THREAT_MODEL.md`](docs/security/THREAT_MODEL.md), [`docs/security/PRODUCTION_READINESS_CHECKLIST.md`](docs/security/PRODUCTION_READINESS_CHECKLIST.md).

---

## 📜 Credits & Sponsors
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- [Blocky402 Facilitator](https://blocky402.com/) & [Hedera Hashgraph](https://hedera.com/)
- [The Graph](https://thegraph.com/)
- [Superfluid Finance](https://superfluid.finance/)
- [Chainlink Functions](https://chain.link/functions)
- [World ID](https://worldcoin.org/world-id)

