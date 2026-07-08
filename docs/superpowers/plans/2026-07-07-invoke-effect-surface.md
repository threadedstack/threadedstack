# Unified `invoke` Effect Surface — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give ThreadedStack a generic effect surface where an agent's output invokes a consumer-defined Function ("invoke `fn` with `args`"), dispatched through one core both as a deferred `tdsk-actions` block and a live `invoke` tool, replacing the 13 hard-coded `persist*` handlers with reusable config — additive and inert until sub-project ⑤ migrates the live loop.

**Architecture:** One dispatch core `invokeAction(app, db, projectId, action, allowlist)` resolves a project-scoped Function by name against an opt-in allowlist and runs it via `FunctionExecutor.execute` with the ①-`records` capability. Two surfaces route through it: a deferred `tdsk-actions` block parsed post-run in the executor (`dispatchActions`), and a live `invoke` agent tool (`createInvokeProvider` → `createInvokeTools`). A new optional `schedule.actions` allowlist gates both; the 11 live schedules carry none, so the surface is a complete no-op for the running dev loop.

**Tech Stack:** TypeScript, Drizzle/PostgreSQL (jsonb column), Express, isolated-vm FaaS (`FunctionExecutor`), Vitest. Source spec: `docs/superpowers/specs/2026-07-07-invoke-effect-surface-design.md`.

---

## File Structure

**Create:**
- `repos/domain/src/types/actions.types.ts` — `TActionsConfig`, `TAgentAction`.
- `repos/domain/src/constants/actions.ts` — `ActionsBlockFence = 'tdsk-actions'`.
- `repos/backend/src/utils/agent/actions.ts` — `parseActionsBlock(text): TAgentAction[]` (mirrors `parseMemoryBlock`; parser lives in backend where the other block parsers live).
- `repos/backend/src/utils/agent/invokeAction.ts` — the dispatch core.
- `repos/backend/src/utils/agent/dispatchActions.ts` — the deferred post-run dispatch.
- `repos/agent/src/types/invoke.types.ts` — `IInvokeProvider` (agent-side capability interface).
- Test files co-located with each of the above.

**Modify:**
- `repos/domain/src/types/ai.types.ts` — add `EAgentTool.invoke`.
- `repos/domain/src/models/schedule.ts` — add `actions?: TActionsConfig | null`.
- `repos/domain/src/types/index.ts` + `repos/domain/src/constants/index.ts` — export the new type/constant (follow existing barrel style).
- `repos/database/src/schemas/schedules.ts` — add `actions` jsonb column.
- `repos/database/src/seeds/agentSchedules.ts` — add optional `actions` to `TAgentScheduleDef`.
- `repos/database/src/seeds/reconcileSchedules.ts` — add `actions` to `declarativeFields` + `needsUpdate`.
- `repos/backend/src/services/scheduler/executor.ts` — one line wiring `dispatchActions` into the success block.
- `repos/backend/src/utils/agent/resolveAgentConfig.ts` — `createInvokeProvider` + gate in the provider block.
- `repos/backend/src/types/agent.types.ts` — add `actions?: string[]` to `TResolveAgentOpts`.
- `repos/agent/src/tools/tools.ts` — `createInvokeTools`.
- `repos/agent/src/runner/runner.ts` + `repos/agent/src/types/runner.types.ts` — wire `invokeProvider`.

**Design deviation from spec:** the spec §5 said `parseActionsBlock` lives "in domain"; the real house pattern puts every block parser in `repos/backend/src/utils/agent/*.ts` (e.g. `parseMemoryBlock` in `memory.ts`). This plan follows the house pattern: the **constant + types** go in domain, the **parser** in backend.

---

## Phase 1: Config + types foundation (domain + database)

Additive, inert. No behavior touches the runtime yet — this lands the types, the fence constant, the `EAgentTool.invoke` value, the `Schedule.actions` field, the `schedules.actions` column, and the reconciler round-trip so a schedule can carry an allowlist without churning the 11 live rows.

**Files:**
- Create: `repos/domain/src/types/actions.types.ts`
- Create: `repos/domain/src/constants/actions.ts`
- Modify: `repos/domain/src/types/ai.types.ts` (add enum value + its test)
- Modify: `repos/domain/src/models/schedule.ts`
- Modify: `repos/domain/src/types/index.ts`, `repos/domain/src/constants/index.ts` (barrels)
- Modify: `repos/database/src/schemas/schedules.ts`
- Modify: `repos/database/src/seeds/agentSchedules.ts`
- Modify: `repos/database/src/seeds/reconcileSchedules.ts`
- Test: `repos/database/src/seeds/reconcileSchedules.test.ts` (extend), `repos/domain/src/types/ai.types.test.ts` (extend)

- [ ] **Step 1: Create the domain types**

`repos/domain/src/types/actions.types.ts`:
```ts
/**
 * The generic effect surface (generalization ②). An "action" is "invoke Function
 * `function` with `args`". Agents emit actions two ways — a deferred
 * ```tdsk-actions``` block and a live `invoke` tool — both dispatched through one
 * core to a consumer-defined Function.
 */

/** A single effect: invoke a project-scoped Function by name with args. */
export type TAgentAction = {
  /** Name of the project-scoped Function to invoke. */
  function: string
  /** Arguments passed to the Function as its `context.args`. */
  args: Record<string, unknown>
}

/**
 * Opt-in effect-surface config carried on a schedule (and agent defaults). The
 * allowlist is the set of Function names the effect surface may invoke; an
 * empty/absent config disables the surface for that schedule (keeps it inert).
 */
export type TActionsConfig = {
  /** Names of project-scoped Functions the effect surface may invoke. */
  functions: string[]
}
```

- [ ] **Step 2: Create the fence constant**

`repos/domain/src/constants/actions.ts`:
```ts
/** Fence label for the generic deferred effect block: ```tdsk-actions```. */
export const ActionsBlockFence = `tdsk-actions`
```

- [ ] **Step 3: Add `EAgentTool.invoke`**

In `repos/domain/src/types/ai.types.ts`, add to the `EAgentTool` enum after `collectionDelete`:
```ts
  collectionDelete = `collectionDelete`,
  invoke = `invoke`,
```

- [ ] **Step 4: Add the `Schedule.actions` field**

In `repos/domain/src/models/schedule.ts`:
```ts
import type { TActionsConfig, TContextSource } from '@TDM/types'
// ...
  contextSources?: TContextSource[] | null
  /** Opt-in effect-surface allowlist (generalization ②). Null/absent ⇒ off. */
  actions?: TActionsConfig | null
```

- [ ] **Step 5: Export from barrels**

Add `export * from './actions.types'` to `repos/domain/src/types/index.ts` and `export * from './actions'` to `repos/domain/src/constants/index.ts` (match the existing ordering/style in each file).

- [ ] **Step 6: Extend the enum test**

In `repos/domain/src/types/ai.types.test.ts`, alongside the `collectionDelete` assertion:
```ts
    expect(EAgentTool.invoke).toBe(`invoke`)
```

- [ ] **Step 7: Add the `schedules.actions` column**

In `repos/database/src/schemas/schedules.ts`: import the type and add the column next to `contextSources`:
```ts
import type { TActionsConfig, TContextSource } from '@tdsk/domain'
// ...
    contextSources: jsonb(`context_sources`).$type<TContextSource[]>(),
    // Opt-in effect-surface allowlist (generalization ②). The executor dispatches
    // a ```tdsk-actions``` block only when this lists ≥1 Function name. Nullable +
    // additive — a schedule without `actions` is byte-unchanged and inert.
    actions: jsonb(`actions`).$type<TActionsConfig>(),
```

- [ ] **Step 8: Add `actions` to `TAgentScheduleDef`**

In `repos/database/src/seeds/agentSchedules.ts`, add to the `TAgentScheduleDef` type (next to the optional `contextSources`):
```ts
  actions?: TActionsConfig | null
```
and import `TActionsConfig` from `@tdsk/domain`. Do NOT set `actions` on any of the 11 live defs — they stay inert.

- [ ] **Step 9: Extend the reconciler**

In `repos/database/src/seeds/reconcileSchedules.ts`, add to `declarativeFields` (after `contextSources`):
```ts
  contextSources: def.contextSources ?? null,
  actions: def.actions ?? null,
```
and add the comparison to `needsUpdate` (after the `contextSources` line):
```ts
  stableStringify(existing.contextSources) !== stableStringify(def.contextSources) ||
  stableStringify(existing.actions) !== stableStringify(def.actions)
```

- [ ] **Step 10: Add the reconciler test**

In `repos/database/src/seeds/reconcileSchedules.test.ts`, add cases proving (a) a def with no `actions` against a live row with no `actions` is `unchanged` (null == undefined, no churn), and (b) a def with `actions: { functions: ['f'] }` against a row without it triggers `updated`. Mirror the existing `contextSources` test cases exactly.

- [ ] **Step 11: Run the checks**

Run: `pnpm --filter @tdsk/domain types && pnpm --filter @tdsk/domain test`
Run: `pnpm --filter @tdsk/database types && pnpm --filter @tdsk/database test`
Expected: all green; new enum + reconciler tests pass.

- [ ] **Step 12: Commit**

```bash
git add repos/domain repos/database
git commit -m "feat(actions): config + types foundation for the invoke effect surface (②1)"
```

### Phase 1 — DEFINITION OF DONE
- `pnpm --filter @tdsk/domain types` + `test` green.
- `pnpm --filter @tdsk/database types` + `test` green.
- New: `TActionsConfig`, `TAgentAction`, `ActionsBlockFence`, `EAgentTool.invoke`, `Schedule.actions`, `schedules.actions` column, `TAgentScheduleDef.actions`, reconciler round-trip.
- Additive only: no existing field/column/def changed; no live schedule sets `actions`.

### Phase 1 — SELF-REVIEW (paste evidence before Phase 2)
1. Paste the four `types`/`test` command outputs (all green).
2. `git show --stat HEAD` — confirm only domain + database files changed.
3. Confirm the reconciler test proves null==undefined no-churn (paste the two new cases + their pass lines).
4. Grep `repos/database/src/seeds/agentSchedules.ts` for `actions:` — confirm ZERO live defs set it.

---

## Phase 2: Dispatch core + deferred `tdsk-actions` block (backend)

Additive, inert. Adds the parser, the `invokeAction` core, the `dispatchActions` post-run dispatch, and one wiring line in the executor gated on `schedule.actions`. The 13 `persist*` calls and their order are untouched.

**Files:**
- Create: `repos/backend/src/utils/agent/actions.ts` + `actions.test.ts`
- Create: `repos/backend/src/utils/agent/invokeAction.ts` + `invokeAction.test.ts`
- Create: `repos/backend/src/utils/agent/dispatchActions.ts` + `dispatchActions.test.ts`
- Modify: `repos/backend/src/services/scheduler/executor.ts` (one line)

- [ ] **Step 1: Write the failing parser test**

`repos/backend/src/utils/agent/actions.test.ts` — cases: valid `{ "actions": [{function,args}] }`; bare array `[{function,args}]`; multiple blocks (last wins); missing block ⇒ `[]`; malformed JSON ⇒ `[]`; entry with non-string `function` dropped; entry with missing `args` defaults to `{}`.

- [ ] **Step 2: Implement `parseActionsBlock`**

`repos/backend/src/utils/agent/actions.ts` (mirror `parseMemoryBlock` at `memory.ts:97-140`):
```ts
import { ActionsBlockFence } from '@tdsk/domain'
import type { TAgentAction } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'

/**
 * Parse the LAST fenced ```tdsk-actions``` block out of runtime stdout into
 * validated actions. Accepts either a bare array `[{function,args}]` or
 * `{ "actions": [ ... ] }`. A missing/invalid block, non-array payload, or
 * malformed JSON yields `[]` (no-op). Entries without a non-empty string
 * `function` are dropped; `args` defaults to `{}`.
 */
export const parseActionsBlock = (text: string): TAgentAction[] => {
  if (!text) return []

  const fenceRegex = new RegExp(
    `\`\`\`${ActionsBlockFence}\\s*\\n([\\s\\S]*?)\`\`\``,
    `g`
  )
  let lastBlock: string | undefined
  for (const match of text.matchAll(fenceRegex)) lastBlock = match[1]
  if (lastBlock === undefined) return []

  let parsed: unknown
  try {
    parsed = JSON.parse(lastBlock)
  } catch {
    logger.debug(`[actions] Ignoring malformed tdsk-actions block`)
    return []
  }

  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === `object` && Array.isArray((parsed as any).actions)
      ? (parsed as any).actions
      : []

  const actions: TAgentAction[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== `object`) continue
    const item = raw as Record<string, unknown>
    if (typeof item.function !== `string` || item.function.trim().length === 0) continue
    actions.push({
      function: item.function,
      args:
        item.args && typeof item.args === `object` && !Array.isArray(item.args)
          ? (item.args as Record<string, unknown>)
          : {},
    })
  }
  return actions
}
```
Confirm the `logger` import path matches how `memory.ts` imports it (adjust to the exact path used there).

- [ ] **Step 3: Run the parser test → green**

Run: `pnpm --filter @tdsk/backend test -- actions.test`
Expected: PASS.

- [ ] **Step 4: Write the failing `invokeAction` test**

`repos/backend/src/utils/agent/invokeAction.test.ts` — cases:
- allowlist reject: `function` not in allowlist ⇒ `{ ok:false, error }`, and `FunctionExecutor.execute` is NOT called (spy).
- unknown function: allowlisted but `list` returns `[]` ⇒ `{ ok:false, error }` (no throw).
- happy path: allowlisted + resolved ⇒ calls `FunctionExecutor.execute(func, { db, context: { args } })`; returns `{ ok:true, data: output }`.
- never throws: `FunctionExecutor.execute` rejects ⇒ returns `{ ok:false, error }` (caught).
Mock `db.services.function.list` and spy on `FunctionExecutor.execute` (mirror the mocking style in `resolveAgentConfig.test.ts`).

- [ ] **Step 5: Implement `invokeAction`**

`repos/backend/src/utils/agent/invokeAction.ts`:
```ts
import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TAgentAction } from '@tdsk/domain'
import { FunctionExecutor } from '@TBE/services/functions/functionExecutor'
import { logger } from '@TBE/utils/logger'

export type TInvokeResult = { ok: boolean; data?: unknown; error?: string }

/**
 * The single dispatch core for the effect surface. Resolves a project-scoped
 * Function by name against an allowlist and runs it via FunctionExecutor with a
 * db handle (so the ① `records` capability is injected). Never throws — any
 * failure is returned as `{ ok:false, error }` so one action can't abort the run
 * or its siblings. Both the deferred `tdsk-actions` block and the live `invoke`
 * tool call this.
 */
export const invokeAction = async (
  _app: TApp,
  db: TDatabase,
  projectId: string,
  action: TAgentAction,
  allowlist: string[]
): Promise<TInvokeResult> => {
  try {
    if (!allowlist.includes(action.function))
      return { ok: false, error: `function not allowed: ${action.function}` }

    const { data: funcs, error } = await db.services.function.list({
      where: { projectId, name: action.function },
    })
    if (error) return { ok: false, error: error.message }
    const func = funcs?.[0]
    if (!func) return { ok: false, error: `function not found: ${action.function}` }

    const res = await FunctionExecutor.execute(func as any, {
      db,
      context: { args: action.args },
    })
    return res.success
      ? { ok: true, data: res.output }
      : { ok: false, error: res.error ?? `function failed` }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    logger.error(`invokeAction failed for ${action.function}: ${message}`)
    return { ok: false, error: message }
  }
}
```
Confirm import paths (`TApp`, `TDatabase`, `FunctionExecutor`, `logger`) against how `resolveAgentConfig.ts` imports the same symbols; adjust to match. Confirm `db.services.function.list` returns `FunctionModel[]` whose shape `FunctionExecutor.execute` accepts (it takes `TFunctionRecord`); if the model needs mapping to the record shape, map it (the model wraps the same fields).

- [ ] **Step 6: Run the `invokeAction` test → green**

Run: `pnpm --filter @tdsk/backend test -- invokeAction.test`
Expected: PASS.

- [ ] **Step 7: Write the failing `dispatchActions` test**

`repos/backend/src/utils/agent/dispatchActions.test.ts` — cases:
- gated off: `schedule.actions` absent/empty ⇒ returns immediately, `invokeAction` NOT called (spy), no throw.
- invokes: `schedule.actions.functions = ['f']` + stdout with a `tdsk-actions` block calling `f` ⇒ `invokeAction` called once with allowlist `['f']`.
- error isolation: two actions, first `invokeAction` rejects/returns `{ok:false}` ⇒ second still invoked; no throw.
- non-allowlisted skipped: block calls `g` not in allowlist ⇒ `invokeAction` returns `{ok:false}` for it, run continues.

- [ ] **Step 8: Implement `dispatchActions`**

`repos/backend/src/utils/agent/dispatchActions.ts`:
```ts
import type { TApp } from '@TBE/types'
import type { Schedule } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { invokeAction } from '@TBE/utils/agent/invokeAction'
import { parseActionsBlock } from '@TBE/utils/agent/actions'

/**
 * Generic post-run effect dispatch (generalization ②). Parses a ```tdsk-actions```
 * block from the run's stdout and invokes each listed Function through the
 * `invokeAction` core, scoped to the schedule's project and gated by the
 * schedule's opt-in allowlist. A no-op when the schedule sets no `actions`, so the
 * live loop (which sets none) is untouched. Each action is isolated — a failure is
 * logged and skipped; the Function itself owns any persistence via `records`.
 */
export const dispatchActions = async (
  app: TApp,
  schedule: Schedule,
  agentId: string,
  stdoutText: string
): Promise<void> => {
  const allowlist = schedule.actions?.functions
  if (!allowlist?.length) return

  const actions = parseActionsBlock(stdoutText)
  if (!actions.length) return

  for (const action of actions) {
    try {
      const res = await invokeAction(app, app.db, schedule.projectId, action, allowlist)
      if (res.ok)
        logger.info(
          `[actions] ${schedule.id} invoked ${action.function} (agent ${agentId})`
        )
      else
        logger.warn(
          `[actions] ${schedule.id} action ${action.function} skipped: ${res.error}`
        )
    } catch (err) {
      logger.error(
        `[actions] ${schedule.id} action ${action.function} threw: ${
          err instanceof Error ? err.message : String(err)
        }`
      )
    }
  }
}
```
Confirm `app.db` is the correct handle name on `TApp` (check how the `persist*` functions reach the db from `app` in `executor.ts` — use the identical accessor).

- [ ] **Step 9: Run the `dispatchActions` test → green**

Run: `pnpm --filter @tdsk/backend test -- dispatchActions.test`
Expected: PASS.

- [ ] **Step 10: Wire `dispatchActions` into the executor**

In `repos/backend/src/services/scheduler/executor.ts`, inside the `if (result.success) { ... }` block (the one at ~1909-1959, after the last `persist*`/`resolveBoard` call), add:
```ts
    // Generic effect surface (generalization ②): dispatch a ```tdsk-actions```
    // block to consumer Functions. No-op unless this schedule opts in via
    // `actions`. Runs AFTER the 13 hard-coded persist* handlers, which are
    // unchanged — ② lands alongside them until ⑤ migrates the loop.
    await dispatchActions(app, schedule, agent.id, stdoutText)
```
Add the import at the top: `import { dispatchActions } from '@TBE/utils/agent/dispatchActions'`. Verify the variable names in scope match (`app`, `schedule`, `agent.id`, `stdoutText`) — they are the exact args the neighboring `persist*` calls receive.

- [ ] **Step 11: Run the full backend suite**

Run: `pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test`
Expected: all green, no regressions.

- [ ] **Step 12: Commit**

```bash
git add repos/backend
git commit -m "feat(actions): dispatch core + deferred tdsk-actions block (②2, additive/inert)"
```

### Phase 2 — DEFINITION OF DONE
- `pnpm --filter @tdsk/backend types` + `test` green.
- `parseActionsBlock`, `invokeAction`, `dispatchActions` implemented + unit-tested (allowlist, unknown-fn, happy, records-capable-context via `db` passthrough, error isolation, gated-off).
- Executor wiring is exactly ONE added line + one import; the 13 `persist*` calls and their order are byte-unchanged.

### Phase 2 — SELF-REVIEW (paste evidence before Phase 3)
1. Paste `pnpm --filter @tdsk/backend types && test` output (green).
2. `git show repos/backend/src/services/scheduler/executor.ts` — confirm the diff is only the import + one `dispatchActions` line; the persist* block is otherwise identical.
3. Paste the `dispatchActions` "gated off" test proving zero `invokeAction` calls when `actions` is absent.
4. Paste the `invokeAction` test proving `FunctionExecutor.execute` receives `{ db, context:{ args } }` (the `db` passthrough is what injects the ① `records` capability).

---

## Phase 3: Live `invoke` tool (agent + backend)

The second surface of "unified invoke": a live `invoke(function, args)` agent tool routing through the same `invokeAction`. Gated on the config allowlist; provider is `undefined` when empty, so no tool is exposed and in-process runs are unaffected.

**Files:**
- Create: `repos/agent/src/types/invoke.types.ts` + export from `repos/agent/src/types/index.ts`
- Modify: `repos/agent/src/tools/tools.ts` (add `createInvokeTools`) + `tools.test.ts`
- Modify: `repos/agent/src/runner/runner.ts` + `repos/agent/src/types/runner.types.ts`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts` (add `createInvokeProvider` + gate)
- Modify: `repos/backend/src/types/agent.types.ts` (`TResolveAgentOpts.actions`)

- [ ] **Step 1: Define the agent-side provider interface**

`repos/agent/src/types/invoke.types.ts` (mirror `records.types.ts`):
```ts
/**
 * Mirrors the IRecordsProvider pattern: the agent package declares the capability
 * it needs; the backend supplies an implementation bridged to the effect core.
 * `invoke` runs a project-scoped, allowlisted Function and returns its result.
 */
export interface IInvokeProvider {
  invoke(
    functionName: string,
    args: Record<string, unknown>
  ): Promise<{ ok: boolean; data?: unknown; error?: string }>
}
```
Export it from `repos/agent/src/types/index.ts` alongside `records.types`.

- [ ] **Step 2: Write the failing `createInvokeTools` test**

In `repos/agent/src/tools/tools.test.ts`, add a `describe('createInvokeTools')` mirroring the `createRecordTools` block: a mock provider; assert the tool set contains `invoke`; assert an allowlist of `[EAgentTool.invoke]` includes it and `[]`/`['shellExec']` excludes it; assert invoking the tool calls `provider.invoke(name, args)` and returns its result.

- [ ] **Step 3: Implement `createInvokeTools`**

In `repos/agent/src/tools/tools.ts` (mirror `createRecordTools` at 577; add `IInvokeProvider` to the type imports at line 14 area):
```ts
/**
 * Build the live effect tool (`invoke`) backed by an IInvokeProvider. Mirrors
 * createRecordTools: a single tool, gated by the optional toolNames allowlist.
 */
export const createInvokeTools = (
  invokeProvider: IInvokeProvider,
  toolNames?: EAgentTool[]
): TAgentToolDef[] => {
  const enabled = (name: EAgentTool) => !toolNames || toolNames.includes(name)
  const tools: TAgentToolDef[] = []
  if (enabled(EAgentTool.invoke)) {
    tools.push({
      name: EAgentTool.invoke,
      description: `Invoke a project Function by name with args and return its result.`,
      parameters: {
        type: `object`,
        properties: {
          function: { type: `string`, description: `The Function name to invoke.` },
          args: { type: `object`, description: `Arguments for the Function.` },
        },
        required: [`function`],
      },
      handler: async (params: { function: string; args?: Record<string, unknown> }) =>
        invokeProvider.invoke(params.function, params.args ?? {}),
    })
  }
  return tools
}
```
Match the exact `TAgentToolDef` shape and the `parameters`/`handler` conventions used by `createRecordTools` in the same file (property names, how the handler result is returned/serialized).

- [ ] **Step 4: Wire the provider into the runner**

In `repos/agent/src/types/runner.types.ts`, add after `recordsProvider?: IRecordsProvider` (import `IInvokeProvider`):
```ts
  invokeProvider?: IInvokeProvider
```
In `repos/agent/src/runner/runner.ts`, import `createInvokeTools` (line ~40) and, next to the `recordTools` block at 690-691:
```ts
    const invokeTools = this.#opts?.invokeProvider
      ? createInvokeTools(this.#opts.invokeProvider, toolNames)
      : []
```
and include `invokeTools` in the array where `recordTools`/`memoryTools` are concatenated into the tool list (find the concatenation site just below and add `...invokeTools`).

- [ ] **Step 5: Run the agent checks → green**

Run: `pnpm --filter @tdsk/agent types && pnpm --filter @tdsk/agent test -- tools.test`
Expected: PASS.

- [ ] **Step 6: Add `actions` to `TResolveAgentOpts`**

In `repos/backend/src/types/agent.types.ts`, add to `TResolveAgentOpts`:
```ts
  /** Effect-surface allowlist (generalization ②); enables the live `invoke` tool. */
  actions?: string[]
```

- [ ] **Step 7: Implement `createInvokeProvider` + gate it**

In `repos/backend/src/utils/agent/resolveAgentConfig.ts`, add a builder near `createRecordsProvider` (109-146):
```ts
/**
 * Build the backend IInvokeProvider bridging the agent `invoke` tool to the
 * effect core. Scoped to one project + an allowlist; every call routes through
 * `invokeAction`, so the live tool and the deferred block share dispatch.
 */
export const createInvokeProvider = (
  app: TApp,
  db: TDatabase,
  projectId: string,
  allowlist: string[]
): IInvokeProvider => ({
  invoke: (functionName, args) =>
    invokeAction(app, db, projectId, { function: functionName, args }, allowlist),
})
```
Import `invokeAction` and `IInvokeProvider`. Then in the provider block (after `recordsProvider`, ~440), add:
```ts
    // Live effect tool (generalization ②). Gated purely on config: only when the
    // agent is project-scoped AND an allowlist was supplied via opts.actions.
    // Empty/absent ⇒ undefined ⇒ no `invoke` tool exposed (mirrors contextSources
    // being config-gated). `actions` is destructured from opts at the top.
    invokeProvider:
      projectId && actions?.length
        ? createInvokeProvider(app, db, projectId, actions)
        : undefined,
```
Add `actions` to the opts destructure at line 231: `const { userId, projectId, providerId, overrides, onPodStart, actions } = opts || {}`.

- [ ] **Step 8: Run the backend checks → green**

Run: `pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test -- resolveAgentConfig.test`
Expected: PASS. If `TResolvedAgentConfig`/`TAgentRuntimeConfig` needs an `invokeProvider?` field to type-check the returned object, add it there mirroring `recordsProvider?`.

- [ ] **Step 9: Full types across both repos**

Run: `pnpm --filter @tdsk/agent types && pnpm --filter @tdsk/agent test`
Run: `pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test`
Expected: all green.

- [ ] **Step 10: Commit**

```bash
git add repos/agent repos/backend
git commit -m "feat(actions): live invoke tool routing through the shared effect core (②3)"
```

### Phase 3 — DEFINITION OF DONE
- `pnpm --filter @tdsk/agent types` + `test` green; `pnpm --filter @tdsk/backend types` + `test` green.
- `invoke` tool exists, is allowlist-filtered, routes to `invokeProvider.invoke` → `invokeAction` (same core as the deferred block).
- Provider is `undefined` when `opts.actions` is empty/absent ⇒ no tool exposed ⇒ in-process runs unaffected.

### Phase 3 — SELF-REVIEW (paste evidence before Phase 4)
1. Paste all four `types`/`test` outputs (green).
2. Paste the `createInvokeTools` test proving allowlist inclusion/exclusion + that the handler calls `provider.invoke`.
3. `git show repos/backend/src/utils/agent/resolveAgentConfig.ts` — confirm the gate is `projectId && actions?.length` and `actions` is destructured from opts.
4. Confirm both surfaces (deferred block, live tool) call the SAME `invokeAction` (grep both call sites).

---

## Phase 4: End-to-end integration + full verification

Prove the generic effect surface end-to-end and apply the additive column to prod.

**Files:**
- Create: `repos/backend/src/utils/agent/dispatchActions.integration.test.ts` (or extend an existing backend integration test that already exercises `FunctionExecutor` + the ① records bridge).

- [ ] **Step 1: Write the end-to-end test**

A backend integration test (mirror ①'s "a Function that upserts + queries" test, which already runs a real `FunctionExecutor` with the records bridge against the test db):
1. Seed a project + a collection `proposals`.
2. Create a Function `recordProposal` in that project whose body does `await context.records.upsert('proposals', { data: context.args })` and returns `{ success:true, output:{ ok:true } }`.
3. Build a `schedule` object with `projectId` + `actions: { functions: ['recordProposal'] }`.
4. Call `dispatchActions(app, schedule, 'ag_test', stdout)` where `stdout` contains a ```tdsk-actions``` block calling `recordProposal` with `args`.
5. Assert `db.services.record.query(projectId, 'proposals', ...)` returns the upserted record — proving stdout → parse → invokeAction → FunctionExecutor → ① records bridge → Collection, end to end.

- [ ] **Step 2: Run it → green**

Run: `pnpm --filter @tdsk/backend test -- dispatchActions.integration`
Expected: PASS.

- [ ] **Step 3: Full verification bar (all four repos)**

Run: `pnpm --filter @tdsk/domain types && pnpm --filter @tdsk/domain test`
Run: `pnpm --filter @tdsk/database types && pnpm --filter @tdsk/database test`
Run: `pnpm --filter @tdsk/backend types && pnpm --filter @tdsk/backend test`
Run: `pnpm --filter @tdsk/agent types && pnpm --filter @tdsk/agent test`
Expected: all green.

- [ ] **Step 4: Prove the live loop is untouched**

- `git diff origin/main -- repos/backend/src/services/scheduler/executor.ts` shows ONLY the one `dispatchActions` import + call; the 13 `persist*` lines are unchanged.
- `grep -n "actions:" repos/database/src/seeds/agentSchedules.ts` returns none of the 11 live defs.

- [ ] **Step 5: Commit + PR**

```bash
git add repos/backend
git commit -m "test(actions): end-to-end invoke effect surface integration (②4)"
```
Open a PR to `main`; let the adversary review gate run; admin-merge once green + approved.

- [ ] **Step 6: Apply the additive column to prod**

After merge + deploy, apply the one nullable column (additive, no drop) via the reviewed idempotent pattern used for the ① tables — a throwaway `tsx` script run with `NODE_ENV=production`:
```sql
ALTER TABLE schedules ADD COLUMN IF NOT EXISTS actions jsonb;
```
Pre/post-check `information_schema.columns WHERE table_name='schedules' AND column_name='actions'`; then `rm` the script. (The reconciler already treats `actions` as null for the 11 live rows, so no schedule row changes.)

### Phase 4 — DEFINITION OF DONE
- End-to-end test green: an agent's `tdsk-actions` output drives a consumer Function that persists into a Collection, read back by a query.
- All four repos `types` + `test` green.
- `schedules.actions` column live in prod (additive, nullable); zero live schedule rows changed.
- Executor diff is the single wiring line; the 13 `persist*` handlers untouched.

### Phase 4 — SELF-REVIEW (final)
1. Paste the end-to-end test pass line.
2. Paste all eight `types`/`test` outputs.
3. Paste the `git diff origin/main` executor summary + the empty `actions:` grep on live defs.
4. Paste the prod column pre-check (absent) → apply → post-check (present).
5. Confirm the surface is inert: no live schedule opts in, so the running dev loop's behavior is byte-identical to pre-②.

---

## Rollout

Purely additive and inert. Each phase lands green behind the existing safe deploy pipeline (push to `main` → `deploy-production.yml` → `tdsk release`, with `verifyOrRollback`). The `schedules.actions` column is a single additive nullable column. Nothing in the surface activates until a consumer sets `actions` on a schedule and their prompt emits `tdsk-actions` — the migration of TDSK's own 13 effects onto this surface is sub-project ⑤.
