# Dev-Loop on Primitives — Design (⑤b)

**Status:** Design (2026-07-08).
**Part of:** the platform-generalization effort (dogfooding). ①②③ (Collections/Records, unified
`invoke`, `contextSources`) are live; ⑤a expressed + activated the exec-board on those primitives and
retired its hard-coded path. **⑤b (this): migrate the LIVE dev-loop the same way — without ever
breaking the running steward/adversary loop.** This is the final sub-project of the generalization.

## 1. Why, and the boundary that makes it tractable

After ⑤a the executor still hard-codes 8 dev-loop handlers. A precise audit (side effects, read-side
consumers, capability gaps) shows they are NOT one kind of thing, and the generalization test — "is
this platform faculty or use-case data?" — splits them cleanly:

**Platform faculties (STAY platform-side; already generic and reusable by any consumer's agents):**
- **Memory** (`persistMemoryWrites`, `buildMemoryContext`, the memory tools): agent memory with
  pgvector embeddings + scored vector search. The ① spec itself declared memory a distinct generic
  primitive ("not replacing memories"). Vector search cannot be expressed by the records query API.
- **Skills** (`persistSkillProposals`/`persistSkillReviews`): skills are a platform feature (skills
  table, agent attachment, curator promotion with a fail-closed re-scan). Any consumer's agents
  author/curate skills the same way.
- **Ops** (`persistOpsReviews` → `applyOpsReview` → K8s execution, `buildOpsReviewContext`): the ops
  faculty executes real K8s operations behind a deterministic scan + adversary review — a platform
  safety/ops capability, not use-case data.

**Use-case workflow (MIGRATES to Collections + Functions + contextSources):**
- **`task_proposals`** (`persistTaskProposals`, `persistTaskPickups`; `buildRunOutcomeContext`
  digest, `buildOpenProposalsDigest`, `buildTaskBacklogContext`, `buildCoordinatorContext`).
- **`verifications`** (`persistVerifications`; `buildVerifyContext`).
- **`escalations`** (`persistEscalations`; `buildEscalationContext`).
These three tables ARE the dev-loop's workflow — exactly the shape another consumer would define
for their own loop, so they must be consumer-definable data, not platform tables.

End state: the executor's post-run pipeline is `persistMemoryWrites` + skills + ops (platform
faculties) + `dispatchActions` (everything else). The dev-loop's workflow lives in Collections,
its effects in project Functions, its context in `contextSources` — identical in kind to the
exec-board.

## 2. Scope

### In scope (⑤b)
- Collections (ops project `pj_tIly2F1`): `task_proposals`, `verifications`, `escalations`
  (schemas mirroring today's columns).
- Effect Functions (ports with behavior parity): `proposeTask` (scan-gated create + dedupe),
  `pickupTask` (mark promoted + prUrl), `recordVerification` (upsert by PR + on-regression open an
  escalation record), `openEscalation` (dedupe + routing-status), `resolveEscalation` (status
  update). Cross-record effects are plain multi-`records` writes inside one Function (⑤a proved
  the pattern); the old handlers' "idempotency memory" side-writes move into the PROMPTS as
  `tdsk-memories` blocks (the ⑤a-4 precedent — the shared memory handler persists them).
- **One new generic Function capability: `context.scan`** — the deterministic, fail-closed content
  scanner (today's `scanTaskProposal`), injected platform-side exactly like `records` (host bridge,
  nothing raw crosses the isolate). Generic: any consumer Function can scan untrusted agent-emitted
  content before persisting it. (The skills/ops scans stay inside their platform faculties.)
- Schedule config: `actions` allowlists + `contextSources` on the dev-loop schedules; prompt
  rewrites from the bespoke fences (`tdsk-tasks`, `tdsk-task-picked`, `tdsk-verify-results`,
  `tdsk-escalations`, `tdsk-escalation-resolutions`) to ONE `tdsk-actions` block per prompt.
- Context migration: `buildTaskBacklogContext`/`buildOpenProposalsDigest`/`buildEscalationContext`/
  `buildVerifyContext`/`buildCoordinatorContext` → `contextSources` entries (the audit confirmed
  the ① query API expresses all of them; small app-side merge quirks — e.g. two-status unions —
  are handled by multiple sources or a slightly widened query, decided in the plan).
  `buildRunOutcomeContext` reads `schedule_runs` (platform telemetry, not use-case data) — it
  STAYS a platform builder, like business metrics.
- Live tool duality: `proposeTask`/`escalate` providers re-point to the same Functions via
  `invokeAction` (one path, two surfaces — the ② principle), or are retired in favor of the
  `invoke` tool per prompt guidance (decided in the plan; behavior parity required).
- **Read-side migration**: admin/API endpoints + integration tests for tasks/verifications/
  escalations move to the collections-backed data (the standard collections endpoints ① shipped),
  with a dual-read window during cutover.
- Data migration: copy live rows from the 3 tables into the Collections at cutover; retire the
  hard-coded handlers/builders/parsers + drop-or-dormant the tables afterward.

### Out of scope
- Memory, skills, ops faculties (stay platform; they are already generic).
- CMO outward sends (separate gated effort).

### Non-goals
- No semantic changes to the loop: scan gates remain fail-closed; dedupe, routing, backlog
  ordering, verify done-set semantics port verbatim (parity-tested like ⑤a).

## 3. The hard constraint: the loop never breaks

The dev-loop ships PRs hourly. Unlike ⑤a (dormant board), ⑤b changes the RUNNING system. The
rollout is therefore strangler-fig, one workflow at a time, with parity gates:

1. **Additive build** (collections + Functions + capabilities + tests) — inert, nothing wired.
2. **Migrate ONE workflow at a time**, lowest-risk first: `task pickups` (pure record write) →
   `task proposals` (adds `context.scan`) → `escalations` → `verifications` (cross-record). For
   each: flip the schedule's prompt + `actions` + `contextSources` in one PR; the old handler
   still exists and simply parses nothing (its fence is no longer emitted); observe N clean live
   cycles; then remove that handler.
3. **Read-side cutover per workflow**: data copied to the collection; admin/API/integration reads
   move; dual-read only within the cutover window.
4. **Retire** the emptied handlers/builders/parsers/tables last, per-symbol importer checks
   (the ⑤a-6 method).
A failed step rolls back by reverting the prompt/config PR (the old handler is still in place
until its removal step) — the loop's behavior is restored by config alone.

## 4. Testing
- Unit parity per Function against its handler (the ⑤a-3 harness: real FunctionExecutor + records
  + scan mocks); `context.scan` bridge tests INCLUDING real-isolate coverage (the ⑤a lesson:
  isolateBridges.real.test.ts extends to the scan bridge).
- End-to-end per workflow through the real ② chain (stdout → dispatch → Function → collection →
  contextSources round-trip), mirroring `execBoardCycle.integration.test.ts`.
- Live observation gates between migration steps (clean steward cycles producing PRs).
- Integration tests migrate with the read side, per workflow.

## 5. Rollout summary
Additive phases behind the normal pipeline; per-workflow cutovers as small config+prompt PRs with
live observation between; retirement last. Deploys batched away from :30 work-cycle windows (the
severance lesson from ⑤a's activation night).
