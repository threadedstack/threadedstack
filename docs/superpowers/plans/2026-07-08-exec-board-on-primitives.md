# Exec-Board on Primitives — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Express the AI executive board (CEO/CTO, CMO-participation) as a consumer app on the platform primitives — Collections for state, Functions (invoked via the ② `tdsk-actions` surface) for effects, `contextSources` for context, records for membership/roles — then activate it and retire the hard-coded exec handlers, leaving zero exec-specific platform code. Additive throughout; the live dev-loop is untouched (its own migration is ⑤b).

**Architecture:** Each board cycle is an ordinary agent run: `contextSources` inject strategy + open decisions, the executive emits one `tdsk-actions` block, ② dispatches to consumer Functions that read/write Collections via the ① `records` capability and authorize by a trusted injected `caller`. Consensus/tiebreak/completion-gate semantics port verbatim from `resolveBoard.ts` into a Function body.

**Tech Stack:** TypeScript, Drizzle/PostgreSQL (Collections ①), isolated-vm FaaS (`FunctionExecutor`), the ② `invokeAction`/`dispatchActions` surface, Vitest. Spec: `docs/superpowers/specs/2026-07-08-exec-board-on-primitives-design.md`.

**Parity is the bar.** Every Function must reproduce the exact behavior of the handler it replaces. The source of truth for each is cited by file:line; port the logic, do not reinvent it.

---

## File Structure

**Modify (Phase 1 — ② caller extension, additive):**
- `repos/domain/src/types/functions.types.ts` — add `caller?` to `TFunctionContext`.
- `repos/backend/src/services/functions/functionExecutor.ts` — pass `caller` into the isolate context.
- `repos/backend/src/utils/agent/invokeAction.ts` — accept + forward `caller`.
- `repos/backend/src/utils/agent/dispatchActions.ts` — pass `{ agentId, scheduleId: schedule.id }`.
- `repos/backend/src/utils/agent/resolveAgentConfig.ts` — `createInvokeProvider` passes the agent's own id as `caller`.

**Create (Phases 2-3 — board data + Functions, as seeds):**
- `repos/database/src/seeds/exec-board/collections.ts` — the 4 collection definitions + seed records.
- `repos/database/src/seeds/exec-board/functions/{openDecision,postPosition,upsertStrategy,reportInitiativeComplete,resolveBoard}.ts` — the 5 Function bodies (source strings) + their Function records.
- Co-located tests for each Function (parity).

**Modify (Phase 4 — schedule config + prompts):**
- `repos/database/src/seeds/agentSchedules.ts` — `actions` + `contextSources` on the 3 board schedules.
- `repos/database/src/seeds/agent-schedules/{ceo-strategy,ceo-board,cto-board}.md` — emit one `tdsk-actions` block.

**Modify (Phase 6 — retire, AFTER activation verified):**
- `repos/backend/src/services/scheduler/executor.ts` — remove the 4 exec `persist*` calls + the `resolveBoard` branch.
- Delete `repos/backend/src/utils/agent/resolveBoard.ts`, the exec context builders, and `repos/backend/src/constants/board.ts` exec constants (keep anything the dev-loop shares — verify per-symbol).

---

## Phase 1: Trusted `caller` extension to ② (additive, inert)

The effect Functions authorize by who invoked them; that identity must be platform-injected, never from model output. Additive: existing callers pass no `caller` and are unaffected.

**Files:** the 5 "Modify (Phase 1)" files above + tests in `repos/backend/src/utils/agent/invokeAction.test.ts` and `functionExecutor.test.ts`.

- [ ] **Step 1: Add `caller` to `TFunctionContext`**

`repos/domain/src/types/functions.types.ts`:
```ts
  /**
   * Platform-injected, trusted identity of the invoker (never from model output).
   * Effect Functions authorize by this (e.g. board role gates).
   */
  caller?: { agentId?: string; scheduleId?: string }
```

- [ ] **Step 2: Thread `caller` through `invokeAction`**

`repos/backend/src/utils/agent/invokeAction.ts` — add an optional `caller` param and forward it:
```ts
export const invokeAction = async (
  _app: TApp,
  db: TDatabase,
  projectId: string,
  action: TAgentAction,
  allowlist: string[],
  caller?: { agentId?: string; scheduleId?: string }
): Promise<TInvokeResult> => {
  // ...unchanged allowlist + resolve...
    const res = await FunctionExecutor.execute(func, {
      db,
      context: { args: action.args, caller },
    })
  // ...
```

- [ ] **Step 3: `dispatchActions` passes the trusted caller**

`repos/backend/src/utils/agent/dispatchActions.ts` — in the loop:
```ts
      const res = await invokeAction(app, app.locals.db, schedule.projectId, action, allowlist, {
        agentId,
        scheduleId: schedule.id,
      })
```

- [ ] **Step 4: live `invoke` tool passes the agent's own id**

`repos/backend/src/utils/agent/resolveAgentConfig.ts` — `createInvokeProvider` gains the agentId and forwards it:
```ts
export const createInvokeProvider = (
  app: TApp, db: TDatabase, projectId: string, allowlist: string[], agentId: string
): IInvokeProvider => ({
  invoke: (functionName, args) =>
    invokeAction(app, db, projectId, { function: functionName, args }, allowlist, { agentId }),
})
```
Update its call site in the provider block to pass `agentId`.

- [ ] **Step 5: `FunctionExecutor` forwards `caller` into the isolate context**

`repos/backend/src/services/functions/functionExecutor.ts` — `caller` is plain JSON already in `opts.context`; confirm `buildWrapperCode(opts.request || {}, opts.context || {}, ...)` serializes the whole context (it does — `context.args` already crosses). No capability, just data. Add a test asserting a Function reads `context.caller.agentId`.

- [ ] **Step 6: Tests + checks**

Run: `pnpm --filter @tdsk/domain types && pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test`
Expected: green. New: `invokeAction` forwards `caller`; a Function sees `context.caller`; existing callers (no `caller`) unaffected.

- [ ] **Step 7: Commit** — `git add repos/domain repos/backend && git commit -m "feat(actions): inject trusted caller identity into effect Functions (⑤a-1)"`

### Phase 1 — DoD
- `pnpm types`+`test` green on domain + backend.
- A Function receives a platform-injected `context.caller`; the deferred block and live tool both supply it; existing callers pass none (inert).

### Phase 1 — SELF-REVIEW
1. Paste the green outputs.
2. Show the test proving `context.caller.agentId` reaches a Function body.
3. Confirm `caller` is sourced from `schedule`/run identity, NOT from `action.args` (grep dispatchActions).

---

## Phase 2: Board Collections + seed data (additive)

Create the 4 Collections in the exec project (`pj_tIly2F1`) with schemas mirroring the current columns, and seed membership + the strategy singleton. No behavior yet.

**Files:** `repos/database/src/seeds/exec-board/collections.ts` + wiring into the existing seed runner; test.

- [ ] **Step 1: Define the collections** (mirror §4 of the spec — `board_members`, `decision_proposals`, `decision_positions`, `company_strategy`, each with a schema whose fields + types match the current schema columns in `repos/database/src/schemas/{decisionProposals,decisionPositions,companyStrategies}.ts`). Use `db.services.collection.upsert`-style idempotent creation keyed by `(projectId, name)`.

- [ ] **Step 2: Seed records** — `board_members`: `{ agentId: 'ag_ceo0001', role: 'ceo', isCEO: true }` and `{ agentId: 'ag_lvUbjp_', role: 'cto', isCEO: false }` (values from `repos/backend/src/constants/board.ts:34,43`). `company_strategy`: one record seeded from the current live `company_strategies` row for the org (or an empty-but-valid initial strategy if none). Idempotent (upsert by a stable key).

- [ ] **Step 3: Wire into the seed path** used by deploy (mirror how `fullorg.ts` / the reconcile step seed org data), gated so re-runs are no-ops.

- [ ] **Step 4: Test** — the 4 collections exist with their schemas; the 2 `board_members` + 1 `company_strategy` records are present; re-running the seed changes nothing.

- [ ] **Step 5: Checks + commit** — `pnpm --filter @tdsk/database types && test` green; `git add repos/database && git commit -m "feat(exec-board): board Collections + membership/strategy seed (⑤a-2)"`

### Phase 2 — DoD
- 4 collections + seed records created idempotently in the exec project; `pnpm types`+`test` green on database.

### Phase 2 — SELF-REVIEW
1. Paste green outputs. 2. Show the seeded `board_members` (CEO isCEO:true, CTO). 3. Confirm idempotency (re-run = no change).

---

## Phase 3: The 5 board Functions (parity with the handlers)

Each Function body runs in the isolate using only `context.records`, `context.caller`, `context.args`. Port the exact logic from the cited source. This is the core phase — do the Functions one per sub-task, each with a parity test, using the mocked FunctionExecutor+records harness from ①/② (`functionExecutor.test.ts` `records capability` describe).

**Files:** `repos/database/src/seeds/exec-board/functions/*.ts` (each exports the Function source string + a Function record for seeding) + a co-located `*.test.ts` per Function.

- [ ] **Step 1: `openDecision`** — parity with `persistDecisions` (`executor.ts:591-659` + `parseDecisionsBlock`). Body: validate caller is a `board_members` record (query by `context.caller.agentId`); upsert a `decision_proposals` record (dedupe by title within project); set `status:'open'`, `round:1`, `openedByAgentId: caller.agentId`. Test: opens a proposal; dedupes; rejects a non-member caller.

- [ ] **Step 2: `postPosition`** — parity with `persistDecisionPositions` (`executor.ts:668-731`). Body: caller must be a board member; target proposal must be `open|deliberating`; upsert a `decision_positions` record keyed (proposalId, callerAgentId, round). Test: records a position; ignores closed proposals; rejects non-members.

- [ ] **Step 3: `upsertStrategy`** — parity with `persistStrategy` (`executor.ts:741-780`). Body: **only if the caller's `board_members` record `isCEO`**; patch the single `company_strategy` record (northStar/segments/positioning/backlog, last-write-wins); **never touch `activeInitiative`**. Test: CEO patches strategy; non-CEO caller is rejected and writes nothing; activeInitiative untouched.

- [ ] **Step 4: `reportInitiativeComplete`** — parity with `persistInitiativeComplete` (`executor.ts:796-870`). Body: **only if caller role=='cto'**; validate report title == frozen `activeInitiative.title`, status `active`, evidence non-empty; mark `complete`; promote next `backlog` item to `activeInitiative` (or clear). Test: valid CTO completion promotes next; title mismatch/empty evidence rejected; non-CTO rejected.

- [ ] **Step 5: `resolveBoard`** — parity with `resolveBoard.ts:52-250` (`resolveBoard` + `commitProposalEffect`). Port verbatim into the Function body against `context.records`: load open proposals + latest per-member positions (from `board_members`); consensus commit; round-advance (`BoardMaxRounds=3`); CEO endorse-tiebreak (`tiebroken`) / object-reject (`rejected`); commit effects — active-initiative freeze (block mid-flight unless stop-the-line abort with all-non-CEO endorse + wind-down), positioning overwrite, other-axis backlog append. Constants (`BoardMaxRounds`, `StopTheLinePrefix`, `StopTheLineEvidenceFlag`) inlined into the body. Test: mirror EVERY case in the existing `resolveBoard.test.ts` (consensus, advance, endorse-tiebreak, object-reject, freeze-blocks-mid-flight, stop-the-line-abort, completion-promotion).

- [ ] **Step 6: Seed the 5 Function records** into the exec project (idempotent), and run `pnpm --filter @tdsk/backend test` (Function bodies are tested there via the harness) + `pnpm --filter @tdsk/database test`.

- [ ] **Step 7: Commit** — `git add repos/database repos/backend && git commit -m "feat(exec-board): 5 board effect Functions with handler parity (⑤a-3)"`

### Phase 3 — DoD
- All 5 Functions implemented + parity-tested against their handlers' cited behavior; `resolveBoard` reproduces every `resolveBoard.test.ts` case. `pnpm types`+`test` green.

### Phase 3 — SELF-REVIEW
1. Paste green outputs. 2. For each Function, name the handler it mirrors + paste its key parity assertion. 3. For `resolveBoard`, list each ported case and its pass line. 4. Confirm role gates read `context.caller`, not `args`.

---

## Phase 4: Schedule config + prompts (additive; still `enabled:false`)

Point the 3 dormant board schedules at the Functions + context, and switch their prompts to emit one `tdsk-actions` block. Schedules stay `enabled:false` — activation is Phase 5.

**Files:** `repos/database/src/seeds/agentSchedules.ts` + the 3 prompt `.md` files + reconciler test.

- [ ] **Step 1: `actions` allowlists** — `ceo-strategy`: `['upsertStrategy','openDecision']`; `ceo-board`: `['postPosition','resolveBoard']`; `cto-board`: `['postPosition','reportInitiativeComplete']` (each role may invoke only its Functions; matches the current per-schedule emit-gates).

- [ ] **Step 2: `contextSources`** — add to all 3 board schedules: Company Strategy (`{collection:'company_strategy', query:{}, as:'Company Strategy'}`) and Open board decisions (`{collection:'decision_proposals', query:{where:[{field:'status',op:'in',value:['open','deliberating']}]}, as:'Open board decisions'}`).

- [ ] **Step 3: Prompts** — edit `ceo-strategy.md`, `ceo-board.md`, `cto-board.md` to emit a single ` ```tdsk-actions ` block of `{function,args}` entries instead of the bespoke `tdsk-strategy`/`tdsk-decisions`/`tdsk-decision-positions`/`tdsk-initiative-complete` fences. The `## Company Strategy` / `## Open board decisions` context now arrives via `contextSources`, so the prompts reference those sections (drop any instruction that assumed a hard-coded builder). `ceo-board.md` closes by emitting `{function:'resolveBoard'}` as its final action.

- [ ] **Step 4: Reconciler round-trip** — `actions` + `contextSources` already reconcile (Phase-1/② + ①); add a test that the 3 board defs carry them and null==undefined no-churn holds.

- [ ] **Step 5: Checks + commit** — `pnpm --filter @tdsk/database types && test` green; `git add repos/database && git commit -m "feat(exec-board): wire board schedules to Functions + contextSources, tdsk-actions prompts (⑤a-4)"`

### Phase 4 — DoD
- 3 board schedules carry `actions` + `contextSources`; prompts emit `tdsk-actions`; schedules still `enabled:false`; reconciler round-trips clean. `pnpm types`+`test` green.

### Phase 4 — SELF-REVIEW
1. Paste green outputs. 2. Show each schedule's `actions` allowlist. 3. Confirm all 3 remain `enabled:false`. 4. Diff a prompt showing the fence → `tdsk-actions` change.

---

## Phase 5: Parity + integration, then ACTIVATE (disclosed go)

- [ ] **Step 1: End-to-end integration test** — a full board cycle on the primitives: CEO opens a decision (`tdsk-actions`→`openDecision`), CEO+CTO `postPosition`, `resolveBoard` commits it, `company_strategy` record updates, and `contextSources` inject the new state into the next cycle's prompt. Reuse the ①/② mocked harness.

- [ ] **Step 2: Cross-path parity test** — for a fixed scenario, assert the primitive path produces the same `decision_proposals`/`company_strategy` end-state the hard-coded handlers would. This is the gate before retiring the handlers (Phase 6).

- [ ] **Step 3: Full bar** — `pnpm types`+`test` green on domain/database/backend/agent. Apply any additive prod data (the 4 collections + seed records) via the reviewed idempotent script pattern, BEFORE activation.

- [ ] **Step 4: ACTIVATION (disclosed go — NOT silent).** Flipping the 3 board schedules to `enabled:true` starts autonomous executives deliberating + writing strategy. Because this changes what the running system does, **surface it explicitly and get an affirmative go before flipping**; do not enable as part of a routine commit. Outward *sends* remain off (draft-first per spec §8) regardless. After go: enable, observe one full open→deliberate→resolve→strategy-update cycle, confirm prod healthy.

- [ ] **Step 5: Commit** the tests + config (activation flag flip only after the go).

### Phase 5 — DoD
- End-to-end + cross-path parity tests green; full bar green; collections applied to prod. Activation performed only after an explicit disclosed go; one live cycle observed clean; prod healthy.

### Phase 5 — SELF-REVIEW
1. Paste the integration + parity pass lines + full bar. 2. Confirm outward sends are still gated off. 3. Paste evidence of one clean live board cycle (post-activation).

---

## Phase 6: Retire the hard-coded exec handlers (AFTER activation verified)

Subtractive, exec-specific — the dev-loop's own handlers are untouched.

- [ ] **Step 1: Confirm the new path is live + producing** the same effects (from Phase 5 observation) before deleting anything.

- [ ] **Step 2: Remove** the 4 exec `persist*` calls (`persistDecisions`/`persistDecisionPositions`/`persistStrategy`/`persistInitiativeComplete`) and the `if (isCeoSchedule) resolveBoard(...)` branch from `executor.ts`; delete `resolveBoard.ts`, the exec context builders (`companyStrategy.ts`/`businessMetrics.ts` — keep businessMetrics if still used, per spec §6) and the exec-only constants in `constants/board.ts`. **Per-symbol check**: anything the dev-loop still imports stays (grep each symbol's importers before deleting).

- [ ] **Step 3: Full bar green**; the live dev-loop unaffected (grep proves its handlers unchanged). Optionally drop the now-unused exec tables after data is confirmed in the Collections (or leave dormant if a drop is deferred for safety — state which).

- [ ] **Step 4: Commit** — `git commit -m "refactor(exec-board): retire hard-coded exec handlers; board now runs on primitives (⑤a-6)"`

### Phase 6 — DoD
- Exec handlers/constants/builders removed; the board runs entirely on primitives; full bar green; dev-loop byte-unchanged.

### Phase 6 — SELF-REVIEW
1. Paste the full bar. 2. Grep-prove no dev-loop handler changed. 3. List each deleted symbol + confirm no remaining importer. 4. Confirm the live board still cycles post-retirement.

---

## Rollout

Phases 1-4 are additive and inert (schedules stay `enabled:false`); each lands green via the normal deploy pipeline. Phase 5 applies the additive collections to prod and **activates behind a disclosed go**. Phase 6 retires exec-only code after the primitive board is proven live. The live dev-loop is never touched — its migration is ⑤b, a separate spec. Outward marketing sends remain a separate, later, gated effort (spec §2).
