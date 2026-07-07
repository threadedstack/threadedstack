# AI Executive Layer SP1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an org-level executive board (CEO agent + evolved-strategist CTO) that directs the existing steward dev loop from market research + real revenue data, with zero human escalation.

**Architecture:** New DB tables + services (`decision_proposals`, `decision_positions`, `company_strategies`) following the `task_proposals`/`escalations` pattern; four new `tdsk-*` fenced blocks parsed by the executor; context injectors (`## Company Strategy`, `## Business metrics`) mirroring the roadmap-injection pattern; new git-versioned schedule prompts reconciled on deploy. The steward/adversary loop is functionally unchanged — the CTO only re-sources what it prioritizes. Land inert (schemas → services → blocks → injectors) then activate (seed agent → prompts → cadence) so prod stays green at every merge.

**Tech Stack:** Drizzle/PostgreSQL (`repos/database`), TypeScript domain models + constants (`repos/domain`), Express backend scheduler/executor (`repos/backend`), git-versioned schedule prompts (`repos/database/src/seeds/agent-schedules`), Vitest.

**Spec:** `docs/superpowers/specs/2026-07-07-ai-executive-layer-sp1-design.md`

**Global rule (every phase):** a phase is DONE only when its DEFINITION-OF-DONE checkpoint passes and I've pasted the evidence in a SELF-REVIEW step. No human gate. Commit frequently; one PR per phase (steward-gated where the phase touches only dev-loop-safe code; `--admin` disclosed only for the activation data changes I own).

---

## File Structure (locked decomposition)

**Create (database):**
- `repos/database/src/schemas/decisionProposals.ts` — board decision proposal rows
- `repos/database/src/schemas/decisionPositions.ts` — per-member, per-round positions
- `repos/database/src/schemas/companyStrategies.ts` — one org-scoped strategy row
- `repos/database/src/services/decisionProposal.ts` (+ `.test.ts`)
- `repos/database/src/services/decisionPosition.ts` (+ `.test.ts`)
- `repos/database/src/services/companyStrategy.ts` (+ `.test.ts`)

**Create (domain):**
- `repos/domain/src/constants/board.ts` — the 4 block fences + parsers
- `repos/domain/src/types/board.types.ts` — exported types (proposal/position/strategy/initiative-complete shapes, enums)

**Modify (backend executor + context):**
- `repos/backend/src/services/scheduler/executor.ts` — parse+persist the 4 new blocks; inject `## Company Strategy` + `## Business metrics`; board resolution + completion gate helpers
- `repos/backend/src/utils/agent/*` — new context builders (`buildCompanyStrategyContext`, `buildBusinessMetricsContext`, `resolveBoard`) as focused files, mirroring existing `buildRunOutcomeContext`/`buildCoordinatorContext`

**Modify (seeds/schedules):**
- `repos/database/src/seeds/agentSchedules.ts` — CEO agent id/sandbox + new schedule defs
- `repos/database/src/seeds/agent-schedules/ceo-strategy.md`, `ceo-board.md`, `cto-board.md` (create); `planning.md` (evolve → CTO)
- `repos/database/src/seeds/fullorg.ts` — CEO agent + sandbox records (inert until schedules enable)

**Modify (schema barrel + migrations):** `repos/database/src/schemas/index.ts` (export new tables); drizzle migration generated + pushed.

---

## Phase 1 — Data model + services + domain blocks (inert)

No behavior change; new tables/services/parsers exist but nothing reads them yet.

### Task 1.1: `decision_proposals` schema + service
**Files:** Create `repos/database/src/schemas/decisionProposals.ts`, `repos/database/src/services/decisionProposal.ts` + `.test.ts`. Modify `schemas/index.ts`.
Mirror `repos/database/src/schemas/task_proposals` (schema) and `repos/database/src/services/taskProposal.ts` (service + BaseService pattern) exactly.

- [ ] Step 1: Write `decisionProposals.ts` schema. Columns: `id` (entityId prefix `dp`), `orgId` (FK, required, indexed), `openedByAgentId` (FK agents), `title` (text), `axis` (text — e.g. `segment|positioning|pricing|active-initiative|resource-bet|other`), `description` (text), `evidence` (jsonb string[]), `status` (text enum: `open|deliberating|committed|tiebroken|rejected|aborted`, default `open`), `round` (integer, default 1), `resolution` (text, nullable), `resolvedRef` (text, nullable), `createdAt`/`updatedAt`. Add `EDecisionStatus`/`EDecisionAxis` enums to `board.types.ts` (Task 1.4) and import.
- [ ] Step 2: Export the table from `schemas/index.ts`.
- [ ] Step 3: Write `decisionProposal.ts` service extending BaseService (copy taskProposal.ts structure): `listByOrg`, `listOpenByOrg` (status in open/deliberating), `get`, `create`, `update`, `advanceRound`. 
- [ ] Step 4: Write `decisionProposal.test.ts` mirroring `taskProposal.test.ts` (create/get/list/update + status transitions). 
- [ ] Step 5: `pnpm --filter @tdsk/database types` then `pnpm --filter @tdsk/database test`. Commit.

### Task 1.2: `decision_positions` schema + service
**Files:** Create `schemas/decisionPositions.ts`, `services/decisionPosition.ts` + `.test.ts`. Modify `schemas/index.ts`.

- [ ] Step 1: Schema columns: `id` (prefix `dpos`), `orgId` (FK), `proposalId` (FK decisionProposals, indexed), `agentId` (FK agents), `stance` (text enum `endorse|object|amend`), `reasoning` (text), `round` (integer), `createdAt`. Unique index `(proposalId, agentId, round)` (one position per member per round).
- [ ] Step 2: Service: `listByProposal(proposalId)`, `latestByProposal(proposalId)` (max round per agent), `create`.
- [ ] Step 3: Tests: create + unique-per-round enforcement + latestByProposal returns one row per agent.
- [ ] Step 4: `pnpm --filter @tdsk/database types` + `test`. Commit.

### Task 1.3: `company_strategies` schema + service
**Files:** Create `schemas/companyStrategies.ts`, `services/companyStrategy.ts` + `.test.ts`. Modify `schemas/index.ts`.

- [ ] Step 1: Schema columns: `id` (prefix `cs`), `orgId` (FK, **unique** — one strategy per org), `northStar` (text), `segments` (jsonb string[]), `positioning` (text), `backlog` (jsonb: array of `{title, rationale, priority}`), `activeInitiative` (jsonb, nullable: `{title, definitionOfDone, evidence, status: 'active'|'complete'|'aborted', committedAt}`), `updatedByAgentId`, `createdAt`/`updatedAt`.
- [ ] Step 2: Service: `getByOrg(orgId)` (returns `{data}` or `{}`), `upsertByOrg(orgId, patch)`, `setActiveInitiative(orgId, initiative)`, `clearActiveInitiative(orgId)` (on completion/abort), `promoteNextFromBacklog(orgId)`.
- [ ] Step 3: Tests: upsert creates-then-updates single row; setActiveInitiative freezes fields; promoteNextFromBacklog moves top backlog item to activeInitiative and removes it from backlog.
- [ ] Step 4: `pnpm --filter @tdsk/database types` + `test`. Commit.

### Task 1.4: domain board constants + types + parsers
**Files:** Create `repos/domain/src/constants/board.ts`, `repos/domain/src/types/board.types.ts`. Export from the domain barrels. Mirror `repos/domain/src/constants/tasks.ts` + `escalation.ts` (fence + non-throwing parser).

- [ ] Step 1: In `board.types.ts` define exported types: `TDecisionProposalInput` (`{title, axis, description, evidence?}`), `TDecisionPositionInput` (`{proposalId, stance, reasoning}`), `TStrategyUpdate` (`{northStar?, segments?, positioning?, backlog?, openInitiativeProposal?}`), `TInitiativeComplete` (`{initiativeTitle, evidenceRefs: string[]}`), and the `EDecisionStatus`/`EDecisionAxis`/`EStance` enums.
- [ ] Step 2: In `board.ts` define the four fences: `StrategyBlockFence='tdsk-strategy'`, `DecisionsBlockFence='tdsk-decisions'`, `DecisionPositionsBlockFence='tdsk-decision-positions'`, `InitiativeCompleteBlockFence='tdsk-initiative-complete'`. For each write a `parseXBlock(text): T[]` that reuses the domain's `lastFencedBlock`+`parseJsonArray` helpers and validates each entry (drop malformed, never throw) — copy the shape of `parseVerifyResultsBlock`/`parseEscalationBlock`.
- [ ] Step 3: Write `board.test.ts`: valid block parses; malformed JSON → `[]`; entries missing required fields dropped; only the LAST fenced block is read.
- [ ] Step 4: `pnpm --filter @tdsk/domain types` + `test`. Commit.

**DEFINITION OF DONE (Phase 1):**
- `pnpm --filter @tdsk/database types` → clean; `pnpm --filter @tdsk/database test` → all green (prior 576 + new tests).
- `pnpm --filter @tdsk/domain types` → clean; `pnpm --filter @tdsk/domain test` → all green (prior 726 + new board tests).
- Drizzle migration generates cleanly (`pnpm --filter @tdsk/database generate` shows only the 3 new tables, no drops).
- Grep proof of inertness: no reference to the new services/blocks in `executor.ts` yet.

**SELF-REVIEW (Phase 1):** paste the four green test summaries + the migration diff (must be additive: 3 CREATE TABLE, 0 DROP). Confirm each of spec §5 (data model) rows maps to a created table. If any DoD command is not green, do not open the PR.

---

## Phase 2 — Company Strategy injection

Make the strategy readable by cycles (still no writer — inert output).

### Task 2.1: `buildCompanyStrategyContext`
**Files:** Create `repos/backend/src/utils/agent/companyStrategy.ts` (+ test). Modify `executor.ts` context assembly (near where `buildRunOutcomeContext`/roadmap are injected).
Mirror `buildRunOutcomeContext` (never throws, returns `''` when absent, char-capped).

- [ ] Step 1: `buildCompanyStrategyContext(app, schedule): Promise<string>` reads `db.services.companyStrategy.getByOrg(schedule.orgId)`; if none → `''`; else render `## Company Strategy\n` with North Star, segments, positioning, the **Active Initiative** (title + definition-of-done + status), and the top-N backlog items. Cap at a new `StrategyInjectMaxChars` domain constant.
- [ ] Step 2: Test: renders active initiative + backlog; returns `''` when no strategy; never throws on service error.
- [ ] Step 3: Wire into executor: inject for exec + dev-loop cycles (append to the same context string the roadmap uses). Gate so a cycle that opts into neither strategy nor board pays nothing (follow the `promptOptsIn` pattern).
- [ ] Step 4: `pnpm --filter @tdsk/backend types` + `test`. Commit.

**DEFINITION OF DONE (Phase 2):** backend types clean; `pnpm --filter @tdsk/backend test` green (prior 2807 + new); a unit test proves the `## Company Strategy` section appears in an assembled cycle context when a strategy row exists and is absent otherwise.
**SELF-REVIEW (Phase 2):** paste backend green summary + the injection test. Confirm no existing executor test regressed (diff the test count; must be ≥ prior).

---

## Phase 3 — Board Room (proposals, positions, resolution)

Executor now persists the board blocks and resolves proposals.

### Task 3.1: persist `tdsk-decisions` + `tdsk-decision-positions`
**Files:** Modify `executor.ts` (add `persistDecisions`, `persistDecisionPositions` mirroring `persistTaskProposals`/`persistEscalations`, called on every cycle's stdout). Tests in `executor.task.test.ts` or a new `executor.board.test.ts`.

- [ ] Step 1: `persistDecisions(app, schedule, stdout)`: parse `DecisionsBlockFence`; for each, `decisionProposal.create({orgId, openedByAgentId: schedule.agentId, ...})`. Dedupe by (orgId, title, open-status) to avoid re-opening.
- [ ] Step 2: `persistDecisionPositions(...)`: parse positions; `decisionPosition.create` with the proposal's current round; ignore positions on closed proposals.
- [ ] Step 3: Tests: a decisions block creates a proposal; a positions block records a stance at the right round; malformed → no-op.
- [ ] Step 4: backend types + test. Commit.

### Task 3.2: board resolution (consensus / CEO tiebreak)
**Files:** Create `repos/backend/src/utils/agent/resolveBoard.ts` (+ test). Modify `executor.ts` to run resolution during a board-resolution cycle.

- [ ] Step 1: `resolveBoard(app, schedule)`: for each open/deliberating proposal in the org — read `decisionPosition.latestByProposal`; determine current board membership (config: list of exec agentIds, CEO flagged). If **all current members endorse** the latest round → `status=committed`, apply commit effect (Task 3.3). If any object/amend and `round < N` (config `BoardMaxRounds=3`) → `advanceRound` (status `deliberating`). If `round >= N` → **CEO decides**: `status=tiebroken`, resolution set from the CEO's latest position (or CEO-agent cycle input), apply commit effect.
- [ ] Step 2: Tests: unanimous endorse → committed; object then re-endorse → committed next round; persistent disagreement to round N → tiebroken by CEO; 2-member board deadlock → CEO tiebreak.
- [ ] Step 3: backend types + test. Commit.

### Task 3.3: commit effect → Company Strategy
**Files:** Modify `resolveBoard.ts` + add `persistStrategy` for `tdsk-strategy`.

- [ ] Step 1: `persistStrategy` (CEO-only agent guard): parse `StrategyBlockFence`; apply non-active-initiative fields via `companyStrategy.upsertByOrg` (northStar/segments/positioning/backlog freely). Active-Initiative changes are NOT applied here — only via the completion gate (Phase 4) or a committed `active-initiative`-axis proposal.
- [ ] Step 2: committed/tiebroken proposal commit effect: if `axis != active-initiative` → apply to strategy (re-order backlog / update positioning). If `axis == active-initiative` → only allowed when there is no active initiative OR it's a stop-the-line abort (guarded in Phase 4).
- [ ] Step 3: Tests: CEO strategy block updates backlog; non-CEO strategy block ignored; committed positioning proposal updates strategy; active-initiative proposal blocked while one is active.
- [ ] Step 4: backend types + test. Commit.

**DEFINITION OF DONE (Phase 3):** backend types clean; full backend test green; tests cover all four resolution outcomes (committed / re-deliberate / CEO-tiebreak / rejected) + CEO-only strategy writes.
**SELF-REVIEW (Phase 3):** paste green summary + list each resolution-path test by name mapping to spec §4.2 steps 1-4. Confirm dev-loop cycles are unaffected (steward work-cycle tests still green, unchanged).

---

## Phase 4 — Commitment & Completion loop

### Task 4.1: `tdsk-initiative-complete` persist + gate
**Files:** Modify `executor.ts` (`persistInitiativeComplete`), `companyStrategy.ts` service (already has clear/promote). Tests.

- [ ] Step 1: `persistInitiativeComplete(app, schedule, stdout)` (CTO-agent guard): parse `InitiativeCompleteBlockFence`; verify the named initiative matches the strategy's `activeInitiative.title` and its `definitionOfDone` evidence refs are present; on match → `companyStrategy` marks active complete, then `promoteNextFromBacklog` (or clear if backlog empty). Record the completion as a durable memory.
- [ ] Step 2: **Completion gate:** in `resolveBoard` commit effect, an `active-initiative`-axis proposal is refused while `activeInitiative.status == 'active'` UNLESS the proposal is flagged `stop-the-line` AND meets the high-bar (all non-CEO members endorse the abort). On abort → mark active `aborted` (wind-down note required in resolution), then promote next.
- [ ] Step 3: Tests: complete-report with matching DoD promotes next; mismatched/insufficient-evidence report is a no-op; active-initiative swap blocked mid-flight; stop-the-line abort with full endorsement succeeds and promotes next.
- [ ] Step 4: backend types + test. Commit.

**DEFINITION OF DONE (Phase 4):** backend green; the four gate tests pass; a unit test proves re-direction is blocked until `initiative-complete` (the core stability guarantee).
**SELF-REVIEW (Phase 4):** paste green summary + name the "re-direction blocked until complete" test and the "stop-the-line abort winds down" test, mapping to spec §4.3.

---

## Phase 5 — Revenue / business instrumentation (read-only)

### Task 5.1: `buildBusinessMetricsContext` + `readBusinessMetrics` tool
**Files:** Create `repos/backend/src/utils/agent/businessMetrics.ts` (+ test). Wire injection in executor (exec cycles). Add a read-only agent tool via the existing tool-provider pattern (`repos/agent/src/tools`).

- [ ] Step 1: `buildBusinessMetricsContext(app, orgId)` aggregates read-only: active subs by tier + count (from `subscription` service), signups (users createdAt window), churn (subs canceled window), usage (from `quota` service current period), waitlist count (access-gate). Render `## Business metrics`. Never throws → `''` on error.
- [ ] Step 2: Tests: aggregation math (MRR/tier counts) from fixture rows; empty org → zeros, not error.
- [ ] Step 3: Inject into CEO + CTO cycles. Add `readBusinessMetrics` tool returning the same aggregate JSON (feature-gated like other tools).
- [ ] Step 4: backend types + test (+ `pnpm --filter @tdsk/agent types+test` if the tool touches agent repo). Commit.

**DEFINITION OF DONE (Phase 5):** backend (+agent) green; aggregation test proves MRR/tier/churn math; injection test proves `## Business metrics` appears in a CEO cycle context.
**SELF-REVIEW (Phase 5):** paste green summaries + the aggregation test values.

---

## Phase 6 — Seed CEO agent + schedules; evolve strategist → CTO

Data + prompts only; still gated off until Phase 7 enables cadence.

### Task 6.1: CEO agent + sandbox records
**Files:** Modify `repos/database/src/seeds/fullorg.ts` (add CEO agent `ag_*` with founder `soul`, `autonomous`, provider binding; CEO body sandbox `sb_*`). Follow the steward seed shape.
- [ ] Step 1: Add CEO agent + sandbox constants + records (inert; `active` set but no schedule references them yet).
- [ ] Step 2: `pnpm --filter @tdsk/database types` + `test` (seed tests green). Commit.

### Task 6.2: schedule prompts + defs
**Files:** Create `agent-schedules/ceo-strategy.md`, `ceo-board.md`, `cto-board.md`. Evolve `agent-schedules/planning.md` into the CTO cycle (reads `## Company Strategy`, derives technical tasks into the steward backlog via `tdsk-tasks`, emits `tdsk-initiative-complete` when the Active Initiative's ledger meets DoD, posts board positions via `tdsk-decision-positions`). Add CEO schedule defs to `agentSchedules.ts` (enabled:false initially).
- [ ] Step 1: Write the three new prompts (souls + cycle mechanics, following the existing prompt style: SESSION MECHANICS + numbered steps + fenced-block outputs).
- [ ] Step 2: Rewrite `planning.md` as the CTO cycle (preserve its backlog-grooming behavior; add strategy-consumption + completion-reporting + board-position output). Keep the steward work-cycle prompt UNCHANGED.
- [ ] Step 3: Add CEO defs to `AgentScheduleDefs` (`enabled:false`); reconciler tests green.
- [ ] Step 4: `pnpm --filter @tdsk/database types` + `test`. Commit.

**DEFINITION OF DONE (Phase 6):** database green; `reconcileSchedules` unit tests still green with the new (disabled) defs; the steward work-cycle prompt file is byte-identical to before (grep-diff proof).
**SELF-REVIEW (Phase 6):** paste green summary + `git diff --stat` showing work-cycle.md unchanged; confirm CEO defs are `enabled:false`.

---

## Phase 7 — Activation + live smoke

Enable the cadence on prod and verify the loop end-to-end.

- [ ] Step 1: Merge Phases 1–6 (each its own green PR, steward-gated or admin-disclosed). Confirm each deploy succeeds (startup probe + rollback alert in place).
- [ ] Step 2: Push the DB migration for the 3 new tables to prod (the interactive `pnpm push` is user-run per CLAUDE.md — if it cannot be auto-run, that is the ONE tool-limited step; state it at the top and drive everything else). Seed the CEO agent+sandbox+strategy row via the prod admin API.
- [ ] Step 3: Flip CEO schedule defs `enabled:true` in `agentSchedules.ts`, deploy → reconciler activates them. Point the CTO (evolved planning) cycle live.
- [ ] Step 4: **Live smoke (definition of done for SP1):**
  - CEO strategy cycle runs → writes a Company Strategy grounded in real `## Business metrics` (verify the row + evidence).
  - CEO opens a board decision → CTO posts a position → resolution commits (or CEO-tiebreaks) → strategy updates.
  - CTO derives a task into the steward backlog from the Active Initiative; the steward work-cycle picks it up (a normal PR appears) and the Active Initiative does NOT change mid-flight.
  - On that initiative's completion (merged+deployed+verified), a `tdsk-initiative-complete` promotes the next backlog item.
- [ ] Step 5: Record a memory with the live agent/schedule IDs + verified behavior.

**DEFINITION OF DONE (Phase 7 / SP1):** all of Step 4 observed in prod with cited run IDs; the existing ≥1-PR/hour dev loop still healthy throughout; no schedule disabled by errors.
**SELF-REVIEW (Phase 7):** paste the strategy row, the resolved decision (run IDs), the strategy-derived steward PR, and a healthcheck showing all schedules green + the new CEO/CTO/board cycles firing on cadence.

---

## Plan Self-Review (against the spec)

- **Spec §4.1 Company Strategy** → Task 1.3 (table), 2.1 (injection), 3.3 (CEO writes). ✓
- **Spec §4.2 Board Room** → Task 1.1/1.2 (tables), 3.1 (persist), 3.2 (resolution), 3.3 (commit). ✓
- **Spec §4.3 Commitment & Completion** → Task 4.1 (complete report + gate + abort). ✓
- **Spec §4.4 CEO / §4.5 CTO** → Task 6.1 (agent), 6.2 (prompts; strategist→CTO). ✓
- **Spec §4.6 Revenue instrumentation** → Task 5.1. ✓
- **Spec §4.7 Guardrails** → 3.3 CEO-only writes, 4.1 gate/abort, board resolution = the check (no human). ✓
- **Spec §5 data model / §6 blocks+schedules** → Phase 1 + 6. ✓
- **Spec §7 testing** → per-phase DoD + Phase 7 live smoke. ✓

No placeholders: every task cites exact files + the existing pattern to mirror + exact DoD commands. Type consistency: enums/types defined in `board.types.ts` (Task 1.4) are consumed by the schemas (1.1/1.2), services, parsers, and executor with the same names. Landing order keeps prod green (inert Phases 1–6, activation Phase 7).
