# Prism 8 — 3-Minute Judge Demo

## One-line takeaway

Prism 8 lets an AI agent perform useful on-chain work without handing it a wallet: authority is scoped, measurable, time-bound, and cryptographically enforced.

## 0:00–0:25 — State the problem

Open the storefront and point to **Judge demo · 60-second proof**.

> AI agents need to make payments and execute workflows, but full wallet custody is unacceptable. Prism 8 grants Hermes a narrow ERC-7579 session key instead: limited actions, a spending cap, and an expiration.

## 0:25–1:00 — Grant bounded authority

Scroll to the **Hermes Mission Cockpit** and click **Grant Session Key (EIP-712)**. Show the wallet’s structured signature request.

> This is not a blanket approval. The user signs an EIP-712 policy binding the smart account, Hermes’s key, allowed targets and selectors, a budget, and time window.

## 1:00–1:50 — Let the agent do useful work

Click **Run Autonomous Mission**. Show the execution ledger as it completes the x402 property-verification flow and surfaces its audit receipt.

> Hermes can settle the permitted 0.5 HBAR x402 verification workflow on Hedera Testnet, validate the property address, and leave an HCS audit trail—without asking for another confirmation.

## 1:50–2:25 — Prove the boundary

Click **Test Guardrail (Simulate Rogue Action)** and show the rejection card.

> Now we ask Hermes to do something outside that policy: an unauthorized treasury transfer. The same cryptographic validator rejects it. Useful autonomy is allowed; unbounded autonomy is not.

## 2:25–3:15 — The Graph Track: Live Blockchain Indexing & Autonomous Tooling

Click **The Graph AI Inspector** button on the storefront.

> For downstream yield distribution, Hermes queries The Graph Studio to index fractional token holders and balances.
> Notice the **LIVE STUDIO** badge and the `_meta` health status. When we click **Run Live Graph Allocation Discovery**, Hermes queries The Graph, verifies zero indexing errors, computes exact proportional shares, and derives per-second Superfluid CFA flow rates.
> Notice the **Data Provenance** tab: every decision records the subgraph deployment hash, block number, and query timestamp. If indexing errors occur or data is stale, the agent fails closed.
> In addition, Hermes is equipped with two isolated MCP servers: `subgraph_read` for safe query inspection and `subgraph_write` for autonomous manifest mutation and deployment to Graph Studio.

## 3:15–3:45 — Show continuous streaming outcome (Superfluid)

Point to the Superfluid Yield Dashboard below the cockpit.

> Once The Graph computes the proportional allocation, Superfluid opens continuous flow agreements (CFA) on Base Sepolia. The storefront counter ticks continuously per-second to show real-time rental yield streaming directly to the verified primary investor.

## Presenter checklist

- Storefront open at `/` and wallet connected to the intended testnet.
- Start at the Judge demo rail; do not lead with every integration.
- Show the actual cockpit controls and ledger results.
- Open **The Graph AI Inspector** to showcase `_meta` indexing health, live holder breakdown, derived CFA flow rates, and data provenance.
- Say “testnet/demo” whenever discussing x402, tokenization, or streaming.
- Point to `docs/THE_GRAPH_QUALIFICATION_EVIDENCE.md` for complete technical proof and automated test commands.
