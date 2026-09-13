# The Graph Qualification & Evidence Guide

**Track**: ETHGlobal — *One AI Track, Two Ways to Build*  
**Pool**: Start Fresh Pool  
**Categories Addressed**:
1. **Track 1**: Best AI Use Case of The Graph (Load-bearing data provider for autonomous agent yield distribution)
2. **Track 2**: Best AI Tooling for The Graph (Autonomous Subgraph lifecycle MCP tooling: read/write separation, dynamic token source registration, build/deploy, and status verification)

---

## 1. Start Fresh Declaration & Honest Scope

- **Start Fresh Pool Qualification**: All The Graph MCP servers, dynamic schema/manifest manipulation scripts, real-time GraphQL shareholder allocation engine, Superfluid CFA flow rate derivation, fail-closed indexing health checks, and provenance verification UI were built fresh for this hackathon submission.
- **Substreams Scope**: We did **not** implement or claim the Substreams one-prompt challenge. We focus purely on deep, production-grade Subgraph indexing on The Graph Studio, Dual-MCP Agent tooling, and load-bearing data provenance for autonomous execution.
- **Fail-Closed Live Mode**: Outside explicit `DEMO_MODE=true`, the platform and agent fail closed with `HTTP 503 / GraphConfigError` if `SUBGRAPH_URL` is missing. No silent mock data fallback is permitted in live mode.

---

## 2. Core Architectural Pillars

### A. Dual MCP Tooling (`subgraph_read` & `subgraph_write`)
Prism 8 enforces strict architectural isolation between read-only blockchain indexing queries and state-mutating Subgraph lifecycle management:

```
┌────────────────────────────────────────────────────────────────────────┐
│                              HERMES AGENT                              │
└──────────────────┬──────────────────────────────────┬──────────────────┘
                   │                                  │
      (Read-Only Context: Safe)             (Privileged Context: Auth Key)
                   │                                  │
                   ▼                                  ▼
┌──────────────────────────────────────┐  ┌──────────────────────────────────────┐
│       subgraph_read MCP Server       │  │      subgraph_write MCP Server       │
├──────────────────────────────────────┤  ├──────────────────────────────────────┤
│ • get_token_info                     │  │ • add_token_source (subgraph.yaml)   │
│ • get_top_holders                    │  │ • set_token_sources (multi-token)    │
│ • get_recent_transfers               │  │ • Autonomous codegen & build        │
│ • get_account_balance                │  │ • Non-interactive graph deploy       │
│ • get_latest_sepolia_block           │  │ • Isolated GRAPH_DEPLOY_KEY storage  │
│ • get_deployment_status (_meta)      │  └──────────────────────────────────────┘
└──────────────────┬───────────────────┘
                   │
                   ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   The Graph Studio (Decentralized Network)              │
│      GraphQL Endpoint: https://api.studio.thegraph.com/query/...       │
└────────────────────────────────────────────────────────────────────────┘
```

| MCP Server | Executable Path | Security Profile | Primary Role |
| :--- | :--- | :--- | :--- |
| `subgraph_read` | `apps/agent/mcps/subgraph/mcp-server/src/read.ts` | Read-Only (Safe) | Queries token analytics, holder balances, transfer history, and `_meta` health. |
| `subgraph_write` | `apps/agent/mcps/subgraph/mcp-server/src/write.ts` | Mutating (Privileged) | Modifies `subgraph.yaml`, executes `graph codegen/build/deploy`, verifies propagation. |

---

### B. Load-Bearing Blockchain Data for Hermes Agent Actions
The Graph is **not** a decorative dashboard in Prism 8; it is an active decision driver in the autonomous execution pipeline:

1. **On-Chain Holder Discovery**: When rental cashflow is received on Sepolia, Hermes queries The Graph to retrieve all token holders and balances.
2. **Mathematical Solvency & Yield Rate Calculation**:
   $$\text{holderShare} = \frac{\text{holderBalance}}{\text{totalEligibleBalance}}$$
   $$\text{flowRatePerSec} = \frac{\text{monthlyRentUsd} \times \text{holderShare}}{2,592,000 \text{ seconds}}$$
3. **Fail-Closed Indexing Health & Freshness Guards**:
   - If `_meta.hasIndexingErrors == true`, Hermes aborts yield streaming (`GraphIndexingError`).
   - If block timestamp is older than `maxStalenessSeconds`, Hermes aborts (`GraphStalenessError`).
   - If holder balances are empty or total balance is 0, Hermes aborts (`GraphDataError`).
4. **Data Provenance Ledger**: Every execution outputs a cryptographic provenance record:
   ```typescript
   {
     subgraphUrl: "https://api.studio.thegraph.com/query/...",
     deploymentId: "Qm...",
     indexedBlockNumber: 11420500,
     indexedBlockTimestamp: 1789302900,
     queryTimestamp: "2026-09-13T18:00:00.000Z",
     hasIndexingErrors: false,
     tokenAddress: "0x71C8401E25687352f20D235F8d7fD1A392cf99a8",
     totalEligibleBalance: "1000000000000000000000",
     holderCount: 3
   }
   ```
5. **Direct Downstream Execution**: Hermes feeds the calculated flow rates directly into Superfluid Constant Flow Agreement (CFA) calls on Base Sepolia.

---

### C. Autonomous Subgraph Management Tools
Hermes can expand its indexing scope at runtime without human intervention:
- `add_token_source`: Appends a new ERC-20 contract to `subgraph.yaml` and deploys.
- `set_token_sources`: Atomically updates the entire tracked token set.
- `get_deployment_status`: Queries `_meta` directly on Graph Studio to verify deployment health and block synchronization before declaring success.

---

## 3. Key Implementation Files

| Component | File Path | Description |
| :--- | :--- | :--- |
| **Core Allocation Engine** | [`apps/platform/src/lib/subgraph/subgraphService.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/src/lib/subgraph/subgraphService.ts) | GraphQL querying, fail-closed guards, proportional math, provenance tracking. |
| **Platform API Gateway** | [`apps/platform/src/app/api/subgraph/route.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/src/app/api/subgraph/route.ts) | GET status & POST proxy supporting custom queries and allocation actions. |
| **Agent Execution Pipeline** | [`apps/platform/src/app/api/agent/execute/route.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/src/app/api/agent/execute/route.ts) | Step C of Hermes mission using live Graph allocation for Step D Superfluid streaming. |
| **UI Proof Inspector** | [`apps/platform/src/components/TheGraphInspectorModal.tsx`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/src/components/TheGraphInspectorModal.tsx) | Live Studio vs Demo badges, `_meta` health, interactive query runner, CFA flow rates. |
| **Read MCP Server** | [`apps/agent/mcps/subgraph/mcp-server/src/read.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/agent/mcps/subgraph/mcp-server/src/read.ts) | 8 read-only MCP tools for agent queries. |
| **Write MCP Server** | [`apps/agent/mcps/subgraph/mcp-server/src/write.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/agent/mcps/subgraph/mcp-server/src/write.ts) | 2 state-mutating MCP tools for autonomous deployment. |
| **MCP Documentation** | [`apps/agent/mcps/subgraph/mcp-server/README.md`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/agent/mcps/subgraph/mcp-server/README.md) | Comprehensive integration guide, configs, and tool references. |
| **Automated Test Suite** | [`apps/platform/src/__tests__/subgraphIntegration.test.ts`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/src/__tests__/subgraphIntegration.test.ts) | 16 Vitest tests for fail-closed guards, math, errors, and routes. |
| **Verification Script** | [`apps/platform/scripts/test-subgraph.mjs`](file:///c:/Users/kidss/OneDrive/Desktop/Eth-global/apps/platform/scripts/test-subgraph.mjs) | 18 automated structural and interface verification assertions. |

---

## 4. Verification Commands for Judges

### 1. Run Automated The Graph Integration Tests
```bash
cd apps/platform
npx vitest run src/__tests__/subgraphIntegration.test.ts
```
*Expected output: 16 passing tests covering fail-closed configuration, math solvency, error invariants, and API proxy routes.*

### 2. Run Subgraph Structural Verification Script
```bash
cd apps/platform
node scripts/test-subgraph.mjs
```
*Expected output: 18/18 assertions passing verifying manifests, schemas, MCP servers, and routes.*

### 3. Run Full Test Suite
```bash
cd apps/platform
npm run test:all
```
*Expected output: All 76+ platform tests, contract tests, and subgraph tests passing.*

### 4. Inspect Live Subgraph Endpoint via cURL / PowerShell
```powershell
# Query live platform endpoint
curl -X POST http://localhost:3000/api/subgraph `
  -H "Content-Type: application/json" `
  -d '{"action": "allocation", "monthlyRentUsd": 3800}'
```

---

## 5. Environment Variables Reference

```bash
# The Graph Studio Configuration
SUBGRAPH_URL="https://api.studio.thegraph.com/query/<SUBGRAPH_ID>/<SUBGRAPH_SLUG>/version/latest"
GRAPH_DEPLOY_KEY="<YOUR_GRAPH_STUDIO_DEPLOY_KEY>"
GRAPH_API_KEY="<YOUR_GRAPH_API_KEY>"
GRAPH_STUDIO_SUBGRAPH_SLUG="liquiditystream-rwa"

# Mode Flags
DEMO_MODE=false # Set to true only for offline simulation
```
