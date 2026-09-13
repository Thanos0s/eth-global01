# Judge Mission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lead the storefront and documentation with a three-step safe-agent judge mission.

**Architecture:** A static presentation rail in the existing catalog page points to the real AgenticSafetyCockpit. Documentation uses the same three-step vocabulary, so the verbal demo and product UI reinforce each other.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Vitest, Markdown.

**Spec:** `docs/superpowers/specs/2026-09-13-judge-mission-design.md`

## Global Constraints

- Do not add API endpoints, contracts, or simulated result states.
- Retain existing workflows and visual style.
- State testnet/demo limitations honestly.
- Run Vitest, typecheck, and ESLint.

---

### Task 1: Judge mission rail

**Files:**
- Modify: `apps/platform/src/components/DeployedTokenCatalog.tsx`

- [ ] Add a three-step, safety-first judge rail above the existing cockpit.
- [ ] Link its CTA to `#safety-cockpit` and name the existing cockpit controls required for each step.
- [ ] Run `npm run typecheck` and `npm run lint` from `apps/platform`.

### Task 2: Judge materials

**Files:**
- Modify: `docs/demo-script.md`
- Create: `docs/JUDGE_BRIEF.md`

- [ ] Rewrite the demo sequence around the safe autonomous-agent mission.
- [ ] Add a one-page judge brief with evidence and explicit testnet limits.
- [ ] Run `npm test` from `apps/platform`.
