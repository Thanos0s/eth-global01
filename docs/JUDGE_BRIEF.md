# Prism 8 — Judge Brief

## What it is

Prism 8 is a testnet real-world-asset workflow where Hermes, an autonomous agent, can verify a property through an x402-paid oracle and coordinate downstream yield operations—without receiving unlimited wallet authority.

## The problem

Agents can automate financial workflows, but ordinary wallet delegation is all-or-nothing. A user needs a way to permit a narrow job while retaining control over budget, timing, and permissible actions.

## The differentiator

Prism 8 uses ERC-7579-style scoped session authority and EIP-712 policy signing. The signed policy binds the smart account, agent key, allowed targets/selectors, value cap, nonce, chain, and validity window. The validator enforces those constraints and can reject a rogue action.

## Live proof path

1. Sign a bounded session in the Hermes Mission Cockpit.
2. Run the autonomous x402 property-verification mission on Hedera Testnet and inspect its HCS audit result.
3. Trigger the rogue-action simulation and show the enforced rejection.
4. Show The Graph holder data and the Superfluid yield panel as downstream utility.

## System map

| Layer | Role |
| --- | --- |
| ERC-7579 / EIP-712 | Constrains agent authority before execution. |
| Hedera x402 + HCS | Pays for property validation and records an audit receipt. |
| The Graph | Indexes asset and holder data for allocation workflows. |
| Superfluid CFA | Streams eligible yield per second on Base Sepolia. |

## Engineering evidence

- 80 Vitest tests currently pass, including 18 ERC-7579/ERC-4337 behavioral integration tests.
- TypeScript typecheck and ESLint pass.
- Contracts compile as part of the production build workflow.

## Honest scope

This is a testnet/demo system. It is not a production offering of tokenized real estate or real-money yield. Production would still require jurisdictional securities counsel, KYC/AML validation, audited contracts, hardened key custody, multisig governance, and production infrastructure.
