# Judge Mission Design

## Goal

Make Prism 8's safe autonomous-agent thesis understandable and demonstrable in the first minute of a judge walkthrough.

## Experience

The storefront will lead with a compact **Judge demo: Safe autonomous mission** rail. It presents three ordered proof points: grant a scoped session, let Hermes complete its x402-backed verification mission, and show that an unauthorized action is denied. The existing Agentic Safety Cockpit remains the execution surface; the rail links judges directly to it instead of reproducing backend behavior.

## Scope

- Add presentational judge-mission content above the existing cockpit on the storefront.
- Ensure the primary CTA moves to the cockpit and calls out the existing session, mission, and guardrail controls.
- Rewrite the demo script as a three-minute safety-first walkthrough, with Graph and Superfluid as downstream proof.
- Add a concise judge brief containing the problem, differentiator, proof checklist, architecture, and test evidence.

## Constraints

- No new API endpoints, contracts, or simulated success states.
- Preserve the current product workflows and existing visual language.
- Describe testnet/demo constraints honestly.
- Verify with Vitest, TypeScript, and ESLint.
