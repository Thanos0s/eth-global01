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

## 2:25–3:00 — Show what safety unlocks

Point to the The Graph and Superfluid sections below the cockpit.

> Once an asset is verified, The Graph indexes holders for allocation and Superfluid streams rental yield per second. Those rails matter because the agent’s authority is enforceable before it touches economic activity.

## Presenter checklist

- Storefront open at `/` and wallet connected to the intended testnet.
- Start at the Judge demo rail; do not lead with every integration.
- Show the actual cockpit controls and ledger results.
- Say “testnet/demo” whenever discussing x402, tokenization, or streaming.
- Keep Graph and Superfluid to the final proof-of-outcome section.
