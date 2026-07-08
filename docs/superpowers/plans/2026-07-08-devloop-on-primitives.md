# Dev-Loop on Primitives — Implementation Plan (⑤b)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the live dev-loop's use-case workflow (task_proposals / verifications / escalations) onto the platform primitives — Collections for state, project Functions invoked via `tdsk-actions` for effects, `contextSources` for context, plus one new generic Function capability (`context.scan`) — one workflow at a time, with live observation gates, without ever breaking the running loop. Memory/skills/ops stay platform faculties.

**Architecture:** Identical in kind to ⑤a (the exec-board migration), which is the working template: `repos/database/src/seeds/exec-board/` (collections + Function seeds + reconciler), the ⑤a-3 parity-test harness, the ⑤a-4 schedule-config/prompt pattern, and the ⑤a-6 retirement method. The one novel platform seam is `context.scan` — the deterministic fail-closed content scanner exposed to Functions exactly like `records` (host bridge; nothing raw crosses the isolate).

**Spec:** `docs/superpowers/specs/2026-07-08-devloop-on-primitives-design.md`. **Parity sources are cited per phase — port, don't reinvent.**

**Cardinal rule:** the loop never breaks. Cutovers are config+prompt PRs, one workflow at a time; the displaced handler stays in place (parsing a fence nothing emits) until its workflow has produced N≥2 clean live cycles; deploys land clear of :30 work-cycle windows.

---

## Phase 1: `context.scan` capability (additive, inert)

The fail-closed scanner as a generic Function capability, mirroring how `records` is bridged.

**Parity/pattern sources:** `records` bridge end-to-end: `TFunctionContext`/`IRecordsCapability` (`repos/domain/src/types/functions.types.ts`), `buildRecordsBridges` + `recordsContextCode` + bridge wiring (`repos/backend/src/services/functions/functionExecutor.ts`), real-isolate tests (`repos/sandbox/src/local/isolateBridges.real.test.ts`). The scanner itself: `scanTaskProposal` (`repos/backend/src/utils/agent/taskScan.ts`) — read it fully; the capability wraps THIS deterministic logic.

- [ ] Add `scan?: IScanCapability` to `TFunctionContext` (domain), `IScanCapability = { content(input: { title?: string; description?: string; [k: string]: unknown }): Promise<{ ok: boolean; reasons: string[] }> }` — shape finalized against what `scanTaskProposal` actually takes/returns (adjust to its real signature; report the mapping).
- [ ] `functionExecutor.ts`: build a `scan` bridge alongside `records` (host-side closure over the deterministic scanner; injected only when the executor opts in — mirror the `opts.db && func.projectId` gating with an explicit `opts.scan` flag or always-on-with-db, decided by matching how records gates; report choice). Extend the isolate-side context code to reconstruct `context.scan` via `__hostCall('scan.content', ...)`.
- [ ] Tests: mocked-executor capability test (mirror the `records capability` describe) + REAL-isolate bridge round-trip in `isolateBridges.real.test.ts` (incl. a slow-scan case — the ⑤a lesson) + a determinism test (same input ⇒ same verdict).
- [ ] DoD: domain/backend/sandbox types+tests green; capability inert (no Function uses it). Commit `feat(actions): context.scan capability for effect Functions (⑤b-1)`.
- [ ] SELF-REVIEW: paste green outputs; prove the isolate never receives the scanner itself (bridge-only); prove existing Functions unaffected.

## Phase 2: Workflow Collections + effect Functions (additive, inert)

**Pattern source:** `repos/database/src/seeds/exec-board/{collections,functions}.ts` + reconciler — extend the SAME reconciler family with a dev-loop module (`repos/database/src/seeds/dev-loop/`).

**Parity sources (port verbatim):** `persistTaskProposals` + `authorTaskProposal` + dedupe (`executor.ts:685`, `task.ts`); `persistTaskPickups`/`markTaskPromoted` (`executor.ts:727`); `persistEscalations`/`openEscalation`+`resolveEscalation` incl. dedupe + target-routing status (`executor.ts:814`, `escalation.ts`, `escalationPromotion.ts`); `persistVerifications`/`upsertByPr` + on-regression escalation (`executor.ts:975`, `verify.ts`).

- [ ] Collections (ops project): `task_proposals`, `verifications`, `escalations` — schemas mirror the live tables column-for-column (read `repos/database/src/schemas/{taskProposals,verifications,escalations}.ts`).
- [ ] Functions: `proposeTask` (caller is board-of-one: validate via `context.caller` membership in the ops agents; `context.scan` gate fail-closed; dedupeKey check via records query), `pickupTask`, `openEscalation` (dedupe + routed/open status semantics), `resolveEscalation`, `recordVerification` (upsert-by-pr semantics via query+replace; on `regressed` ALSO upsert an escalation record — multi-collection write in one body). NOTE: the old handlers' idempotency-memory side-writes are NOT in the Functions — Phase 4 moves them into prompts as `tdsk-memories` (⑤a-4 precedent).
- [ ] Parity tests per Function (the ⑤a-3 harness; every behavioral branch of the cited handlers, incl. scan-reject ⇒ status `rejected`, dedupe hits, regression⇒escalation).
- [ ] DoD: database+backend green; reconciler idempotent (run-twice test); nothing wired. Commit `feat(dev-loop): workflow Collections + effect Functions with handler parity (⑤b-2)`.
- [ ] SELF-REVIEW: per-Function parity assertions pasted; multi-collection write proven; scan gate proven fail-closed.

## Phase 3: contextSources for the workflow context (additive, inert)

**Parity sources:** `buildTaskBacklogContext` (`executor.ts:646`), `buildOpenProposalsDigest` (`:613`), `buildEscalationContext` (`:769`), `buildVerifyContext` (`:891`), `buildCoordinatorContext` (`:1140`) — read each; reproduce its query shape as `contextSources` entries (two-status unions become two sources or an `in` filter; hierarchy/dedup quirks resolved app-side by the PROMPT reading two sections). `buildRunOutcomeContext` STAYS (platform telemetry).
- [ ] Define the source constants next to the board ones in `agentSchedules.ts` (same style), but DO NOT attach them to live defs yet.
- [ ] A rendering-parity test: for seeded records, the contextSources render contains the same facts the legacy builder injected (field-level, not byte-level — formats differ; the prompt rewrite in Phase 4+ owns comprehension).
- [ ] DoD: database green; live defs untouched (grep-proof). Commit `feat(dev-loop): declarative context sources for the workflow context (⑤b-3)`.

## Phase 4+: Per-workflow cutovers (one PR each; live observation between; ORDER FIXED)

**Cutover template (each workflow):** flip the relevant schedule prompts to emit `tdsk-actions` (+ `tdsk-memories` where the old handler side-wrote memories) + attach `actions` allowlists + `contextSources`; deploy OFF the :30 window; **observe ≥2 clean live cycles** (PRs produced; records landing; `[actions] invoked` logs); THEN remove the emptied handler + its parser/fence + legacy builder in a follow-up PR (⑤a-6 per-symbol method); THEN migrate the read side (data copy via the ⑤a idempotent-script pattern; admin/API endpoints + integration tests re-pointed to the collections endpoints).

- [ ] **4a. Task pickups** (pure record write; lowest risk): work-cycle prompt emits `pickupTask`; backlog context via contextSources.
- [ ] **4b. Task proposals** (sensor/planning/coordinator prompts; `context.scan` live).
- [ ] **4c. Escalations** (all-cycles context + steward routing semantics; resolution memories via `tdsk-memories`).
- [ ] **4d. Verifications** (verify-cycle prompt; regression⇒escalation cross-write; verify memories via `tdsk-memories`).
- [ ] Each cutover has its own DoD (green bar + N clean cycles + records verified in prod) and SELF-REVIEW before the next begins.

## Phase 5: Retirement + read-side completion

- [ ] Remove the 4 displaced handlers + parsers/fences + legacy builders (per-symbol importer checks; the remaining executor pipeline = memory + skills + ops + dispatchActions).
- [ ] Data: final sync of the 3 tables into Collections; admin/API/integration fully on collections endpoints; tables dormant (drop deferred, data-safety — the ⑤a-6 stance).
- [ ] Full bar green across domain/database/backend/agent/sandbox + integration; the loop's PR cadence unbroken across the whole migration (evidence: schedule_runs + merged-PR history).
- [ ] Commit `refactor(dev-loop): retire hard-coded workflow handlers; the dev-loop runs on primitives (⑤b-5)`.
- [ ] FINAL SELF-REVIEW: the generalization test — grep the executor/backend for any dev-loop-workflow-specific code (must be none beyond the platform faculties); a consumer could now build the entire loop from Collections + Functions + Schedules + config.

## Rollout

Phases 1-3 additive/inert (normal pipeline). Each Phase-4 cutover is an independently revertible config+prompt PR with the old handler still in place until proven. Phase 5 retires last. Deploys batched away from :30. If any live gate fails: revert the cutover PR (config-only restore), root-cause, re-attempt — never leave the loop degraded.
