# AI Attribution & Spec-Driven Development Record

> **ETHGlobal 2026 Submission Compliance Document**  
> *In accordance with ETHGlobal guidelines on Transparency, Integrity, Attribution, Human Involvement, and Spec-Driven Development.*

---

## 1. Executive Summary & Human Involvement Statement

**Prism 8 (LiquidityStream)** is an original, multi-chain autonomous real-estate tokenization and continuous yield-streaming engine conceived, architected, and engineered by our team for ETHGlobal 2026.

AI tools were leveraged as **accelerators and technical pair-programmers**—assisting with boilerplate generation, smart contract hardening, test suite coverage, and TypeScript type safety—while **all critical architectural decisions, security invariants, protocol selections, and integration flows were conceived and directed by team members.**

### Human Team Core Contributions:
1. **System & Protocol Architecture:** Conceived the multi-chain orchestration combining Hedera Testnet (HTS tokenization, sub-cent x402 payments, HCS consensus audit trails), Ethereum Sepolia (ERC-20 RWA tokens), and Base Sepolia (Superfluid CFA per-second continuous yield streams).
2. **Security & Cryptographic Guardrails:** Designed the ERC-7579 modular account abstraction model, EIP-712 scoped session key policy limits, single-use invoice replay protection, and fail-closed production invariants.
3. **Live Infrastructure & Deployments:** Deployed and verified live smart contracts, deployed our custom Subgraph (eth) to The Graph Studio, configured live Hedera operator credentials, and orchestrated containerized deployment on Railway.
4. **Physical-World Data Verification:** Designed the USPS DPV (Delivery Point Validation) normalization pipeline and Chainlink oracle consumer architecture.

---

## 2. AI Tools Used

| Tool | Provider | Purpose & Scope |
| :--- | :--- | :--- |
| **Hermes AI Agent (Local)** | Nous Research | Autonomous on-chain AI agent running locally in container, querying MCP tools, settling x402 payments, and executing yield operations. |
| **Google Antigravity / Coding Assistant** | Google DeepMind | Pair programming, test generation (94 Vitest tests), refactoring, Next.js build debugging, and spec documentation. |
| **Claude Code (CLI)** | Anthropic | Scaffolding Model Context Protocol (MCP) server interfaces (subgraph_read, subgraph_write) and AssemblyScript mapping boilerplate. |
| **Cursor / Copilot** | Anysphere / GitHub | Inline TypeScript typing, Tailwind CSS styling, and contract ABI integration. |

---

## 3. Component & File-by-File Attribution Matrix

| Component / Layer | Primary Files | Human Role | AI Role |
| :--- | :--- | :--- | :--- |
| **Smart Contracts** | contracts/PropertyRegistry.sol<br>contracts/SessionKeyValidator.sol<br>contracts/USPSChainlinkConsumer.sol<br>contracts/YieldVault.sol<br>contracts/CompliantRwaToken.sol | Conceived the ERC-7579 validator model, session key policy constraints, Chainlink oracle consumer logic, and Superfluid continuous flow math. | Assisted in writing solc compile scripts (scripts/compile-contracts.mjs), OpenZeppelin v5 contract interfaces, and unit test assertions. |
| **Hermes Agent & MCPs** | pps/agent/server.py<br>pps/agent/mcps/subgraph/<br>pps/agent/mcps/hedera/<br>pps/agent/mcps/superfluid/<br>pps/agent/mcps/worldid/ | Conceived the dual-MCP architecture (subgraph_read vs subgraph_write using GRAPH_DEPLOY_KEY), tool privilege separation, and runtime tool registration. | Generated boilerplate MCP tool definitions, FastMCP JSON schemas, and command-line execution wrappers (deploy.mjs). |
| **The Graph Subgraph** | pps/agent/mcps/subgraph/subgraph/schema.graphql<br>.../src/mapping.ts<br>pps/platform/src/lib/subgraph/subgraphService.ts | Designed the Token, Account, and Transfer entities, proportional shareholder math, and data provenance requirements. | Assisted in generating AssemblyScript event handlers, GraphQL query strings, and fail-closed staleness check logic. |
| **x402 Micropayment Rail** | pps/platform/src/lib/x402/oracleService.ts<br>pps/platform/src/lib/x402/settlementVerifier.ts<br>pps/platform/src/app/api/x402/ | Designed RFC 9110 compliant HTTP 402 challenge/response flow, single-use invoice hash bindings, and Hedera Mirror Node settlement verification. | Generated mock data structures, helper functions for tinybar formatting, and automated Vitest verification suites. |
| **Hedera Integration** | pps/platform/src/lib/hedera/tokenService.ts<br>pps/platform/src/lib/hedera/hcsAudit.ts<br>pps/platform/src/lib/hedera/client.ts | Designed HTS compliance key options (KYC, freeze, wipe, pause) and HCS verifiable audit trail anchoring. | Assisted in @hiero-ledger/sdk gRPC client initialization, transaction freeze handling, and Hashscan link formatting. |
| **Frontend & Cockpit** | pps/platform/src/components/AgenticSafetyCockpit.tsx<br>.../PropertyTokenizeModal.tsx<br>.../TheGraphInspectorModal.tsx<br>.../TokenWorkspace.tsx | Conceived UI/UX wireframes, user journeys, rogue action testing controls, and live visual data provenance badges. | Scaffolding React 19 components, Tailwind CSS utility classes, Lucide icon bindings, and state hooks. |
| **Automated Verification** | pps/platform/src/__tests__/*.ts<br>scripts/test-contracts.mjs<br>scripts/test-subgraph.mjs | Defined test cases, security threat boundaries, replay attack assertions, and single-use invoice requirements. | Synthesized mock responses, test fixture generators, and cross-platform Vitest runner configurations. |

---

## 4. Spec-Driven Development Workflow & Planning Artifacts

Our development followed a rigorous **Spec-First** methodology before implementation code was produced. All core planning specifications and architecture traces are checked into the repository:

### Repository Planning Specifications:
* **Security Architecture:** [docs/security/SECURITY_ARCHITECTURE.md](docs/security/SECURITY_ARCHITECTURE.md) — Comprehensive defense-in-depth model, session key lifecycle, fail-closed boundaries.
* **Threat Model:** [docs/security/THREAT_MODEL.md](docs/security/THREAT_MODEL.md) — STRIDE analysis evaluating replay attacks, spoofed payments, and unauthorized agent mutations.
* **Production Readiness Checklist:** [docs/security/PRODUCTION_READINESS_CHECKLIST.md](docs/security/PRODUCTION_READINESS_CHECKLIST.md) — 76-point verification gate covering automated tests, audit trails, and invariants.
* **The Graph Qualification Evidence:** [docs/THE_GRAPH_QUALIFICATION_EVIDENCE.md](docs/THE_GRAPH_QUALIFICATION_EVIDENCE.md) — Architectural mapping and live verification evidence for The Graph hackathon track.
* **Multi-Chain Architecture:** [docs/architecture.md](docs/architecture.md) — Data flow and cross-chain interaction sequences.

### Human Engineering Prompts & Directives (Sample Logs):

#### Prompt 1: ERC-7579 Scoped Session Key Module
> *"Design an ERC-7579 compliant SessionKeyValidator module in Solidity for modular smart accounts. The validator must strictly enforce: (1) grantor smart account address, (2) authorized agent grantee address, (3) allowed contract targets and function selectors, (4) maximum spend cap in native currency, (5) replay prevention nonce, and (6) validity timestamp window. If an agent attempts an unauthorized selector or exceeds the spend cap, the execution must revert on-chain."*

#### Prompt 2: Dual MCP Server Architecture for The Graph
> *"We need two separate Model Context Protocol (MCP) servers for The Graph to follow least-privilege security: (1) subgraph_read: a read-only server exposing tools like get_top_holders, get_token_info, and get_deployment_status without any shell or file write access; (2) subgraph_write: a privileged server that takes a GRAPH_DEPLOY_KEY, modifies subgraph.yaml via dd_token_source, executes graph codegen, graph build, and graph deploy to Graph Studio, and verifies deployment health. Keep them completely isolated."*

#### Prompt 3: x402 Micropayment Rail with Hedera Mirror Node Verification
> *"Implement the Property Oracle endpoint with HTTP 402 Payment Required semantics. When an unauthenticated request arrives, generate a cryptographic challenge with invoice ID, payee address, and tinybar cost. When a settlement transaction ID is presented in the X-Payment-Tx header, query the Hedera Testnet Mirror Node API to confirm: transaction status is SUCCESS, recipient matches payee, amount is sufficient, and invoiceId is present in memo. Reject any invoice reuse with HTTP 400. Once verified, log an immutable audit record to HCS topic 0.0.10522243."*

---

## 5. Verification & Integrity Checklist

- [x] **Clear Attribution:** Every component identifies human vs AI contribution.
- [x] **Substantial Human Involvement:** All core protocols, security designs, smart contract logic, and deployments were team-conceived and directed.
- [x] **Full Spec Inclusion:** All architecture specs, threat models, and verification checklists are committed in docs/.
- [x] **Reproducible Build & Tests:** 
pm run test executes 94 automated tests verifying all claims on-chain and in-memory.
