<p align="center">
  <img src="brand/banner-16x9.png" alt="LiquidityStream banner" width="100%" />
</p>

# LiquidityStream — Autonomous Real-Estate Yield Streaming Engine

**LiquidityStream** turns the Mint & Chill agent-operated RWA platform into a specialized **Real-Estate Yield Streaming Engine**. It combines **Hedera x402** machine-to-machine payments, **Hedera Token Service (HTS)** fractionalization, **Superfluid CFA** per-second yield streaming on Base Sepolia, and **USPS Chainlink** physical address validation.

Built for **ETHGlobal 2026** (Hedera Agentic Economy Challenge & Superfluid / EVM tracks).

---

## ⚡ Why This Solves the Hedera x402 Challenge

The agentic economy requires payment rails that work at machine speed: sub-second finality, predictable sub-cent fees, and native token operations without smart contract overhead. 

LiquidityStream delivers:
1. **Live x402-gated service on Hedera Testnet**: A metered property verification & physical address validation oracle (`/api/x402/property-oracle`) settled through the **Blocky402** facilitator.
2. **Autonomous Consuming Agent (Hermes)**: Hermes detects HTTP 402 challenges, signs and broadcasts micropayments (0.5 HBAR) on Hedera testnet, and completes paid queries end-to-end with **zero human intervention, no API keys, and no subscriptions**.
3. **Verifiable Payment Audit Trails on HCS**: Every settlement is anchored to a **Hedera Consensus Service (HCS) Topic**, creating an unforgeable, consensus-timestamped public audit log verifiable on HashScan.
4. **Scheduled Transactions for Yield**: Rent distributions are queued and scheduled via native Hedera `ScheduleCreate` transactions.
5. **Agent Discovery via Directory**: Public machine-readable service directory exposed at `/.well-known/agent-services.json` and `/api/x402/directory`.

---

## 🌊 Continuous Real-Time Yield Streaming (Superfluid CFA)

Unlike traditional rental platforms that distribute yield once a month, LiquidityStream streams rental cashflows **per-second**:
* Rental inflows are deposited into `YieldVault.sol` on Base Sepolia (wrapping stablecoins into `fUSDCx` Super Tokens).
* Continuous Flow Agreements (CFA) stream yield directly into fractional token holders' wallets every single second:
  $$\text{flowRate} = \frac{\text{monthlyRentUsd} \times \text{investorShareRatio}}{2,592,000 \text{ seconds}}$$
* A real-time ticking dashboard in the storefront animates continuous balance accumulation (updating every 80ms).

---

## 🏛️ Architecture

```
                           ┌──────────────────────────────────────────────┐
                           │      Public Next.js Storefront & App         │
                           │  - Real-Estate Listing Form (USPS verified)  │
                           │  - Live Superfluid Yield Ticker Dashboard    │
                           │  - "Simulate Tenant Rent Payment" Trigger    │
                           │  - World ID Verification Modal               │
                           └──────────────────────┬───────────────────────┘
                                                  │ (REST / Webhooks)
                                                  ▼
                           ┌──────────────────────────────────────────────┐
                           │     Hermes Autonomous Operator Console       │
                           │  - Natural language property tokenization    │
                           │  - Mandatory USPS address check policy       │
                           │  - Automated per-second flow rate math       │
                           │  - Real-time stream management & freezing    │
                           └──────────────────────┬───────────────────────┘
                                                  │ (MCP Protocol)
                 ┌────────────────────────────────┴────────────────────────────────┐
                 ▼                                                                 ▼
      ┌─────────────────────┐                                           ┌─────────────────────┐
      │ usps_chainlink_mcp  │                                           │   superfluid_mcp    │
      │  (Address & x402)   │                                           │  (CFA Stream Mgmt)  │
      └──────────┬──────────┘                                           └──────────┬──────────┘
                 │                                                                 │
                 ├───────────────────────────────┐                                 │
                 ▼                               ▼                                 ▼
┌──────────────────────────────────┐ ┌───────────────────────────┐ ┌──────────────────────────────────────┐
│          Hedera Testnet          │ │      HCS Audit Topic      │ │             Base Sepolia             │
│ - x402 Oracle Payment Settlement │ │ - Consensus timestamps    │ │ - PropertyRegistry.sol (Metadata)   │
│ - Native HTS Real-Estate Shares  │ │ - Publicly auditable on   │ │ - YieldVault.sol (Rent Staking)     │
│ - Scheduled Yield Transactions   │ │   HashScan                │ │ - USPSChainlinkConsumer.sol         │
│ - Blocky402 Facilitator          │ │                           │ │ - Superfluid CFAv1 (fUSDCx Streams) │
└──────────────────────────────────┘ └───────────────────────────┘ └──────────────────────────────────────┘
```

---

## 🤖 Hermes MCP Integrations

Hermes is equipped with 6 specialized MCP tools:

- **`usps_chainlink` (New)** — Validates physical property addresses against USPS records, intercepts and settles x402 challenges via Hedera Testnet, and anchors verified hashes.
- **`superfluid` (New)** — Opens, updates, monitors, and freezes per-second CFA yield streams on Base Sepolia (`fUSDCx`).
- **`hedera`** — Deploys and operates real estate shares via native HTS with compliance controls.
- **`evm`** — Operates EVM ERC-20 tokens on Sepolia.
- **`worldid`** — Verifies investor identity and selfie proofs in the trusted backend.
- **`subgraph`** — Queries indexed EVM transfers and holder distributions.

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
Open `http://localhost:3000` to view the storefront, live stream dashboard, and rent simulator.

### 2. Run the Verification Tests
```bash
# Test x402 Oracle & Agent Discovery
node apps/platform/scripts/test-x402-oracle.mjs

# Test Smart Contracts (PropertyRegistry, YieldVault, USPSChainlinkConsumer)
node apps/platform/scripts/test-contracts.mjs

# Test usps_chainlink MCP
python apps/agent/mcps/usps_chainlink/test_server.py

# Test superfluid MCP
python apps/agent/mcps/superfluid/test_server.py
```

### 3. Deploy to Railway
Keep root directory at `/`. Railway builds `apps/agent/Dockerfile` with the whole repo as context, running Next.js, Hermes, and all 6 MCP servers in a single unified container.

---

## 🎬 5-Minute Demo Script
See [`docs/demo-script.md`](docs/demo-script.md) for the step-by-step judge walkthrough covering:
1. Agent service discovery at `/.well-known/agent-services.json`
2. Autonomous x402 micropayment on Hedera Testnet
3. USPS DPV delivery verification & HTS token minting
4. Continuous Superfluid per-second yield streaming
5. HCS verifiable consensus audit trail on HashScan

---

## 📜 Credits
- [Mint & Chill](https://github.com/Tanguyvans/ethlisbon)
- [Hermes Agent](https://github.com/NousResearch/hermes-agent) by [Nous Research](https://nousresearch.com/)
- [Blocky402 Facilitator](https://blocky402.com/) & [Hedera Hashgraph](https://hedera.com/)
- [Superfluid Finance](https://superfluid.finance/)
- [Chainlink Functions](https://chain.link/functions)
