# Unified `invoke` Effect Surface — Design

**Status:** Design approved (2026-07-07). Direction ("Both — unified invoke") was chosen
during the platform-generalization brainstorming; this spec pins the remaining forks.
**Part of:** the platform-generalization effort — making ThreadedStack's autonomous-agent
orchestration reusable primitives instead of hard-coded platform code (dogfooding).
This is **sub-project ②**. Sequence: ① Collections/Records (done, live) →
**② generic effect surface (unified `invoke`)** (this) → ③ generic context injection →
④ generic coordination/roles → ⑤ migrate the dev-loop + exec-board off the hard-coded tables.

## 1. Why

After an agent run succeeds, the executor runs **13 hard-coded effect handlers**
(`executor.ts:1909-1959`): `persistMemoryWrites`, `persistSkillProposals`,
`persistSkillReviews`, `persistTaskProposals`, `persistTaskPickups`, `persistEscalations`,
`persistVerifications`, `persistOpsReviews`, `persistDecisions`, `persistDecisionPositions`,
`persistStrategy`, `persistInitiativeComplete`, and `resolveBoard`. Each parses a fixed
`tdsk-*` fenced block out of stdout (`tdsk-tasks`, `tdsk-verify-results`, `tdsk-decisions`,
…) and writes to a fixed use-case table (`task_proposals`, `verification`,
`decision_proposals`, …). The set of effects a consumer's agents can produce is welded into
the platform codebase. A consumer building a *different* autonomous system cannot add an
effect without editing `executor.ts` and shipping a new table.

The fix is a **generic effect surface**: an agent expresses an effect as
**"invoke Function `fn` with `args`"**, and the platform dispatches it to a
**consumer-defined Function** (FaaS). Because a Function invoked with a project scope already
receives the ①-`records` capability (`functionExecutor.ts:280-283`), the Function can persist
into the consumer's own Collections. Once this exists, every one of the 13 hard-coded effects
becomes an ordinary consumer Function + `tdsk-actions` output; nothing use-case-specific stays
in the dispatch pipeline (the retirement of the 13 handlers is sub-project ⑤, not this one).

## 2. Scope

### In scope (sub-project ②)
- **One dispatch core** `invokeAction(...)` — resolve a project-scoped Function by name,
  enforce an allowlist, execute via `FunctionExecutor.execute` (records-capable context),
  return `{ ok, data, error }`, never throw.
- **A deferred generic block** `tdsk-actions` — parsed post-run; each entry is
  `{ function, args }`; dispatched through `invokeAction`. This is the generic replacement
  for the 13 named blocks (they are NOT removed here — ② lands alongside them).
- **A live `invoke` tool** — an agent tool routing through the same `invokeAction`, so the
  agent can invoke a Function mid-run and use its result.
- **An opt-in `actions` config** on schedules (and agent defaults): the allowlist of Function
  names the effect surface may invoke. Absent/empty ⇒ the surface is OFF for that schedule.
- Full unit + integration coverage.

### Out of scope (later sub-projects)
- Removing / rewriting any of the 13 `persist*` handlers or their tables. ⑤
- Migrating the dev-loop / exec-board prompts to emit `tdsk-actions`. ⑤
- New context injection (shipped as `contextSources` in ①). ③

### Non-goals
- Not a general RPC surface — an action only invokes a **Function the consumer already
  defined in the project**, and only if it is on the schedule's allowlist.
- Not changing how Functions execute, transpile, or sandbox — ② reuses `FunctionExecutor`
  as-is.

## 3. Architecture

```mermaid
flowchart LR
  subgraph Agent run
    OUT["stdout: ```tdsk-actions\n[{function,args}]```"]
    TOOL["live tool: invoke(function, args)"]
  end
  subgraph Platform (additive, opt-in)
    PARSE["parseActionsBlock\n(domain, lenient)"]
    DISPATCH["dispatchActions\n(executor post-run, gated on schedule.actions)"]
    CORE["invokeAction(projectId, name, args, allowlist)"]
    OUT --> PARSE --> DISPATCH --> CORE
    TOOL --> CORE
  end
  CORE -->|allowlist check + name→Function| FE["FunctionExecutor.execute\n(injects ① records capability)"]
  FE -->|records.upsert/query| COL["consumer Collections"]
  CORE -->|"{ok,data,error}"| RES["result: returned to agent (tool)\nor logged (deferred)"]
```

- **Action** = `{ function: string, args?: object }` — "invoke Function `function` with `args`".
- **One core** (`invokeAction`) backs **both** surfaces, so the live tool and the deferred
  block are the same operation expressed two ways (the "Both — unified invoke" decision).
- **Opt-in + inert:** the deferred dispatch and the live tool are gated on
  `schedule.actions.functions` being non-empty. The 11 live schedules carry no `actions`
  config, so ② is a complete no-op for the running dev loop until ⑤ migrates it.

## 4. Config model

### `TActionsConfig` (new, domain)
```ts
export type TActionsConfig = {
  /** Names of project-scoped Functions the effect surface may invoke. */
  functions: string[]
}
```

### `Schedule.actions` (new optional field)
- Add `actions?: TActionsConfig | null` to the `Schedule` model
  (`repos/domain/src/models/schedule.ts`) and the schedule types, exactly mirroring how
  `contextSources?: TContextSource[] | null` was added in ①.
- Add an `actions` jsonb column to the `schedules` table
  (`repos/database/src/schemas/schedules.ts`) — **additive, nullable, no drop**.
- Extend the schedule reconciler (`repos/database/src/seeds/reconcileSchedules.ts`) so
  `actions` is a declarative field compared via `stableStringify` with `null == undefined`,
  so the 11 live schedules (which set no `actions`) never churn — identical to the ①
  `contextSources` reconciler change.

The allowlist lives on the **schedule** (mirrors `contextSources`, the other run-shaping
config). Both the deferred dispatch (executor, per run) and the live tool
(`resolveAgentConfig`, per agent) read the same allowlist so the two surfaces are unified.

## 5. The `tdsk-actions` block + parser

- New fence constant `ActionsBlockFence = 'tdsk-actions'`
  (`repos/domain/src/constants/actions.ts`), matching the `tdsk-*` family.
- `parseActionsBlock(text): TAgentAction[]` in domain, mirroring `parseMemoryBlock`
  (`repos/backend/src/utils/agent/memory.ts:97-140`): extract the **last** ```tdsk-actions```
  fenced block, `JSON.parse`, validate. **Lenient input:** accept either a bare array
  `[{function,args}]` or `{ "actions": [ ... ] }`; normalize to `TAgentAction[]`. Each entry
  must have a string `function`; `args` defaults to `{}`. Invalid/missing block ⇒ `[]`
  (never throws), so a run that emits no actions is unaffected.

```ts
export type TAgentAction = { function: string; args: Record<string, unknown> }
```

## 6. The dispatch core

`invokeAction(app, db, projectId, action, allowlist): Promise<{ ok, data?, error? }>`
(`repos/backend/src/utils/agent/invokeAction.ts`):

1. **Allowlist gate:** if `action.function` is not in `allowlist`, return
   `{ ok: false, error: 'function not allowed' }` — no execution.
2. **Resolve:** look up the Function by `(projectId, name)` via the function service. Not
   found ⇒ `{ ok: false, error: 'function not found' }`.
3. **Execute:** `FunctionExecutor.execute(func, { db, context: { args: action.args } })`.
   Because `opts.db` is passed and the Function has a `projectId`, the executor injects the
   ①-`records` capability automatically — the Function can persist into Collections with no
   extra wiring.
4. **Return** the executor's `{ success, output, error }` normalized to `{ ok, data, error }`.
5. **Never throws** — any internal error is caught and returned as `{ ok: false, error }`,
   so a bad action can never abort the run or sibling actions.

This is the single seam both surfaces call.

## 7. Access paths

### 7.1 Deferred block (executor post-run)
`dispatchActions(app, schedule, agentId, stdoutText)`
(`repos/backend/src/utils/agent/dispatchActions.ts`), wired into the executor's success
block **alongside** the 13 `persist*` calls (`executor.ts:1909-1959`), added as one line:
`await dispatchActions(app, schedule, agent.id, stdoutText)`.

- **Gate:** returns immediately if `schedule.actions?.functions?.length` is falsy — the 13
  existing handlers and the live loop are untouched.
- Parse `tdsk-actions`; for each action, `invokeAction(..., allowlist = schedule.actions.functions)`.
- **Error isolation:** each action is awaited independently; a failure is logged and skipped
  (mirrors `buildContextSourcesSection` degradation and the per-entry safety inside the
  existing `persist*`). Results are logged for the run; the Function itself owns any
  persistence (via `records`).

### 7.2 Live tool (`invoke`)
A new tool provider `createInvokeProvider(app, db, projectId, allowlist)`
(`repos/backend/src/utils/agent/resolveAgentConfig.ts`, mirroring `createRecordsProvider`
at 109-146), exposing a single tool `invoke(function, args)` that calls the same
`invokeAction` and returns its `{ ok, data, error }` to the agent. Wired into the provider
block (`resolveAgentConfig.ts:430-464`).

**Gate = the config allowlist, no new global flag.** The provider is built only when the
resolved project exists AND the allowlist is non-empty; an empty/absent allowlist ⇒ provider
`undefined`, no `invoke` tool exposed. This mirrors how ①'s `contextSources` is gated purely
on config presence (not a feature flag), and is the same opt-in that keeps the deferred block
inert — so the two surfaces enable together. The allowlist reaches the per-agent
`resolveAgentConfig` through the run opts (`TResolveAgentOpts`), populated from
`schedule.actions.functions` by the schedule run path (the same path that already threads
`projectId` in); an ad-hoc agent run with no schedule passes no allowlist and gets no tool.

The agent already had a low-level `onExecuteFunction(functionId, input)` (403-413) that
resolves by **id**; `invoke` is the ergonomic, **name-based, allowlist-scoped** surface that
shares the effect semantics with the deferred block.

## 8. How the 13 hard-coded effects map onto this (illustrative — NOT migrated here)
Later (sub-project ⑤): `persistTaskProposals` becomes a consumer Function `recordProposal`
that `records.upsert('proposals', …)`; the steward's prompt emits
```tdsk-actions [{ "function": "recordProposal", "args": { … } }]``` instead of `tdsk-tasks`;
the schedule's `actions.functions` lists `recordProposal`. `resolveBoard`, `persistStrategy`,
etc. map the same way. ② only builds the surface; the migration is its own sub-project so the
live loop is never disturbed.

## 9. Testing
- **Unit (domain):** `parseActionsBlock` — valid `{actions:[…]}`, bare array, multiple blocks
  (last wins), missing/invalid ⇒ `[]`, non-string `function` rejected, `args` defaults to `{}`.
- **Unit (backend):** `invokeAction` — allowlist reject (not executed), unknown function ⇒
  `{ok:false}` (no throw), happy path resolves + executes + returns output, the injected
  context carries the `records` capability (a Function that upserts + a follow-up query reads
  it back). `dispatchActions` — gated off when no `actions` config; with config, invokes each
  listed action; one failing action does not block the others or throw; a non-allowlisted
  `function` in the block is skipped.
- **Unit (backend/agent):** the `invoke` tool routes to `invokeAction`, enforces the
  allowlist, returns the result; provider is `undefined` when the allowlist is empty.
- **Integration:** a schedule with `actions:{functions:['recordProposal']}` and an agent whose
  output emits a `tdsk-actions` block calling `recordProposal` ⇒ the Function runs, upserts a
  record via the ① `records` capability, and a later `collectionQuery` reads it back — the
  full generic effect surface proven end-to-end.
- **Verification bar:** `pnpm --filter @tdsk/{domain,database,backend,agent} types` + `test`
  green; additive-only migration (1 nullable column, 0 drops); no existing test regresses; the
  live dev-loop is untouched (the 13 `persist*` calls and their order are byte-unchanged, and
  every live schedule has no `actions` config so `dispatchActions` is a no-op).

## 10. Rollout
Purely additive and inert. Land the column + config field + parser + dispatch core + deferred
dispatch + live tool (all no-ops until a consumer sets `actions` on a schedule and their
prompt emits `tdsk-actions`) behind the existing safe deploy pipeline. The migration of TDSK's
own 13 effects onto this surface is sub-project ⑤.
