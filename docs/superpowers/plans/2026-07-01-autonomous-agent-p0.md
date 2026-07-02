# Autonomous Agent P0 Implementation Plan (Brain Alive + Scheduled)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an `agent` come alive as a persistent, self-continuing entity that wakes on a heartbeat with a durable identity (SOUL) and episodic continuity, driven by its own brain (`AgentRunner`) instead of a raw pod CLI, on a read-only surface (no delivery).

**Architecture:** Evolve the existing `agents` entity in place. Add a `soul` constitution pinned to the top of every system prompt; add `agentId` + a continuity `threadId` to `schedules`; branch the scheduler executor so an agent-backed schedule resolves the agent's config and runs `AgentRunner.run` against a durable thread, while the existing pod-CLI path stays unchanged. Nothing is a new entity; the `AgentRunner` engine is reused untouched. This is P0 of the design spec `docs/superpowers/specs/2026-07-01-autonomous-agent-design.md`. P1 to P5 are separate plans (phasing resequenced 2026-07-01: P1 = bounded PR author, memory moved to P2).

**Tech Stack:** TypeScript, Drizzle ORM (PostgreSQL), Express 5, Vitest, pi-mono (`@earendil-works/pi-agent-core`), Kubernetes sandbox pods, the `AgentRunner` library (`@tdsk/agent`).

---

## Project conventions for this plan

- **Commits are performed manually by the user** (project ABSOLUTE rule: never run `git commit`). Each "Stage" step runs `git add` and prints the conventional commit message for the user to run. Do NOT run `git commit`.
- **`pnpm push` (drizzle-kit) is interactive and must be run by the user** from `repos/database`. Claude/executing agents cannot run it. All four new columns in this plan are nullable/defaulted (additive), so the push applies without a destructive prompt.
- **Migrations are applied once, batched, in Task 10** (after the schema edits in Tasks 2 and 5). Type-checks and unit tests in earlier tasks pass without the DB push because unit tests mock the DB and types are compile-time.
- Per-repo verification commands: `cd repos/<repo> && pnpm test` (Vitest unit) and `cd repos/<repo> && pnpm types` (`tsc --noEmit`). Integration tests (`repos/integration`) are separate and require live K8s; Task 11 owns full tier1 green after the flag flip.

## File structure (what each change is responsible for)

- `repos/domain/src/constants/featureFlags.ts` — flip `agents` flag on.
- `repos/admin/src/constants/nav.tsx` + `nav.test.tsx` — restrict org-level Agents nav to admins; fix flag-flip test breakage.
- `repos/integration/src/tier1/direct-paths.test.ts` — invert the flag-off 404 assertion to prove the flag is on.
- `repos/domain/src/models/agent.ts` — declare `soul` + `autonomous` on the Agent model.
- `repos/database/src/schemas/agents.ts` — `soul` + `autonomous` columns.
- `repos/agent/src/types/runner.types.ts` — add `soul?` to `TAgentInitOpts`.
- `repos/agent/src/runner/runner.ts` — pin the SOUL at the top of the system prompt (init + updateConfig).
- `repos/backend/src/types/agent.types.ts` — carry `soul` through the resolved config.
- `repos/backend/src/utils/agent/resolveAgentConfig.ts` — return `soul`.
- `repos/backend/src/services/endpoints/agentEndpoint.ts` — forward `soul` to the runner on the headless path.
- `repos/backend/src/services/websocket/websocket.ts` — forward `soul` on the persistent chat path.
- `repos/backend/src/endpoints/agents/updateAgent.ts` — accept `soul` + `autonomous` on update (createAgent already passes them via its `...agent` body spread).
- `repos/database/src/schemas/schedules.ts` — `agentId` + `threadId` columns.
- `repos/domain/src/models/schedule.ts` — declare `agentId` + `threadId`.
- `repos/backend/src/endpoints/schedules/createSchedule.ts` + `updateSchedule.ts` — accept optional `agentId`; clear the continuity thread when `agentId` changes.
- `repos/admin/src/components/Agents/AgentDrawer.tsx` + `AgentSettingsForm.tsx` — edit `soul` + `autonomous` in the admin UI.
- `repos/admin/src/components/Schedules/ScheduleDrawer.tsx` + `repos/admin/src/components/Selectors/` + `repos/admin/src/routes/loaders.ts` — optional agent picker on schedules.
- `repos/backend/src/types/backend.types.ts` — type `scheduleExecutor` on locals.
- `repos/backend/src/services/scheduler/executor.ts` — branch to `AgentRunner` for agent-backed schedules; continuity thread.

---

## Task 1: Enable the `agents` feature flag (and absorb the flip's blast radius)

**Files:**
- Modify: `repos/domain/src/constants/featureFlags.ts:5`
- Modify: `repos/admin/src/constants/nav.tsx:55`
- Modify: `repos/admin/src/constants/nav.test.tsx:438`
- Modify: `repos/integration/src/tier1/direct-paths.test.ts:85`
- Test: `repos/domain/src/constants/featureFlags.test.ts`

- [ ] **Step 1: Write the failing test**

Add this case inside the top-level `describe` in `repos/domain/src/constants/featureFlags.test.ts` (the file already imports `FeatureFlags` and `isFeatureEnabled` from the module under test; reuse those imports):

```ts
it(`has the agents feature enabled`, () => {
  expect(FeatureFlags.agents.enabled).toBe(true)
  expect(isFeatureEnabled(`agents`)).toBe(true)
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd repos/domain && pnpm test src/constants/featureFlags.test.ts`
Expected: FAIL (`expected false to be true`), because `agents.enabled` is currently `false`.

- [ ] **Step 3: Flip the flag**

In `repos/domain/src/constants/featureFlags.ts`, change the `agents` entry:

```ts
export const FeatureFlags: TFeatureFlags = {
  agents: {
    enabled: true,
    description: `AI agent orchestration system`,
  },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd repos/domain && pnpm test src/constants/featureFlags.test.ts`
Expected: PASS

- [ ] **Step 5: Run the backend suite for regressions**

Run: `cd repos/backend && pnpm test`
Expected: PASS. Verified: no backend unit test asserts agent routes 404 while the flag is off; the `featureGate('agents')` sites (`endpoints/agents/agents.ts:30,51`, `endpoints/orgs/orgAgents.ts:17`, `endpoints/orgs/orgProjects.ts:154`, `endpoints/ai/ai.ts:10`) simply begin passing requests through. If anything fails anyway, fix the assertion to match the flag being on; do not silence it.

- [ ] **Step 6: Restrict org-level Agents nav to admins and fix the admin nav tests**

Flipping the flag makes the Agents nav visible. Org-level visibility must be admin-restricted (product decision); project-level stays member-visible.

In `repos/admin/src/constants/nav.tsx:55`, change the org `Agents` item (the `hasOrgAdmin` helper already exists at `nav.tsx:38`):

```ts
  Agents: {
    text: `Agents`,
    to: buildRoute(ERoutePath.OrgAgents),
    Icon: <RobotIcon />,
    visible: (ctx) => hasOrgAdmin(ctx) && isFeatureEnabled(`agents`),
  },
```

This keeps the org member-hidden assertion at `nav.test.tsx:269` green unchanged. The project-level item (`nav.tsx:142`, `hasOrgAndProject && isFeatureEnabled('agents')`) stays as-is, so the project nav test breaks: in `nav.test.tsx:438`, move `Agents` OUT of `memberHidden` (`['API Keys', 'Settings', 'Agents']` becomes `['API Keys', 'Settings']`) and INTO the `memberVisible` array in the same test, because project members now see it.

Run: `cd repos/admin && pnpm test src/constants/nav.test.tsx`
Expected: PASS
Run: `cd repos/admin && pnpm test`
Expected: PASS

- [ ] **Step 7: Invert the integration flag-off assertion**

`repos/integration/src/tier1/direct-paths.test.ts:85` currently asserts `GET /_/agents` returns 404 because the flag is off. Rewrite the test (keep it; do not delete) to prove the flag is ON:

```ts
test('GET /_/agents returns 200 now that the agents feature flag is enabled', async () => {
  // The /agents router is wrapped with featureGate('agents'); with the flag
  // ON the request passes through to the authed list handler.
  const res = await get('/agents')

  expect(res.status).toBe(200)
  expect(res.ok).toBe(true)
})
```

If the list handler requires scoping params and rejects with a 4xx other than 404, assert that exact status instead; the invariant to encode is "no longer 404-by-feature-gate". This file runs against live K8s in Task 11; a local unit run is not possible.

Note: ~20 latent integration suites gated by `describe.skipIf(!isFeatureEnabled('agents'))` (tier1 `agents`, `sessions`, `messages`, `thread-write-ops`, etc., tier3 agent-execution suites, and the tier2 Playwright agent specs) become active with this flip. They are run and fixed in Task 11.

- [ ] **Step 8: Type-check**

Run: `cd repos/domain && pnpm types && cd ../admin && pnpm types`
Expected: PASS

- [ ] **Step 9: Stage (user commits)**

```bash
git add repos/domain/src/constants/featureFlags.ts repos/domain/src/constants/featureFlags.test.ts repos/admin/src/constants/nav.tsx repos/admin/src/constants/nav.test.tsx repos/integration/src/tier1/direct-paths.test.ts
```
Commit message for the user to run:
`feat(agents): enable the agents feature flag for the autonomous agent`

---

## Task 2: Add `soul` + `autonomous` to the agents schema and Agent model

**Files:**
- Modify: `repos/database/src/schemas/agents.ts:34,52`
- Modify: `repos/domain/src/models/agent.ts:21-22`
- Test: `repos/domain/src/models/agent.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `repos/domain/src/models/agent.test.ts` (the file already imports `Agent`):

```ts
describe(`soul and autonomous`, () => {
  it(`carries soul and autonomous through the constructor`, () => {
    const agent = new Agent({
      name: `Steward`,
      orgId: `org-1`,
      soul: `I am the ThreadedStack steward.`,
      autonomous: true,
    })
    expect(agent.soul).toBe(`I am the ThreadedStack steward.`)
    expect(agent.autonomous).toBe(true)
  })

  it(`defaults autonomous to false and soul to undefined`, () => {
    const agent = new Agent({ name: `Plain`, orgId: `org-1` })
    expect(agent.autonomous).toBe(false)
    expect(agent.soul).toBeUndefined()
  })

  it(`preserves soul and autonomous through getEffectiveConfig`, () => {
    const agent = new Agent({
      name: `Steward`,
      orgId: `org-1`,
      soul: `base soul`,
      autonomous: true,
    })
    const eff = agent.getEffectiveConfig()
    expect(eff.soul).toBe(`base soul`)
    expect(eff.autonomous).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd repos/domain && pnpm test src/models/agent.test.ts`
Expected: FAIL (`agent.soul` is `undefined` / `autonomous` is `undefined`).

- [ ] **Step 3: Declare the fields on the Agent model**

In `repos/domain/src/models/agent.ts`, add two fields alongside the existing declarations (after `systemPrompt?: string` and `active: boolean = true`):

```ts
  systemPrompt?: string
  soul?: string
  active: boolean = true
  autonomous: boolean = false
```

No change to `getEffectiveConfig` is needed: it returns `this` when no `projectId` is passed, and otherwise builds `new Agent({ ...this, ... })`, so `soul`/`autonomous` are carried via the `...this` spread.

- [ ] **Step 4: Add the columns to the agents table**

In `repos/database/src/schemas/agents.ts`, add `soul` right after `systemPrompt` (line 34) and `autonomous` right after `active` (line 52):

```ts
  /** System prompt for the agent */
  systemPrompt: text(`system_prompt`),

  /** Durable identity/constitution, pinned to the top of the system prompt */
  soul: text(`soul`),
```

```ts
  /** Whether this agent is active and can be used */
  active: boolean(`active`).default(true),

  /** Whether this agent has autonomy faculties (heartbeat/delegation/delivery) enabled */
  autonomous: boolean(`autonomous`).default(false),
```

`text` and `boolean` are already imported on line 14. `TDBAgentSelect`/`TDBAgentInsert` are drizzle-inferred (`$inferSelect`/`$inferInsert`), so they update automatically; the agent DB service `model()` spreads `...data`, so the new fields round-trip without further edits.

- [ ] **Step 5: Run the tests and type-checks**

Run: `cd repos/domain && pnpm test src/models/agent.test.ts`
Expected: PASS
Run: `cd repos/domain && pnpm types && cd ../database && pnpm types`
Expected: PASS

- [ ] **Step 6: Stage (user commits)**

```bash
git add repos/database/src/schemas/agents.ts repos/domain/src/models/agent.ts repos/domain/src/models/agent.test.ts
```
Commit message: `feat(agents): add soul and autonomous fields to the agent entity`

---

## Task 3: Pin the SOUL at the top of the system prompt in the runner

**Files:**
- Modify: `repos/agent/src/types/runner.types.ts:48-77`
- Modify: `repos/agent/src/runner/runner.ts:55-56,160-179,398-428,492`
- Test: `repos/agent/src/runner/runner.test.ts`

- [ ] **Step 1: Write the failing tests**

Add to `repos/agent/src/runner/runner.test.ts`. Note the fixtures: `baseOpts()` is a top-level shared fixture (line 129), but `baseInitOpts()` is a LOCAL fixture defined separately inside two describe blocks (lines 1024 and 1120). Put the first test below in a new top-level `describe('soul')` using `baseOpts()`; put the second test INSIDE the existing updateConfig describe (line 1120), which has its own local `baseInitOpts()`; the assertion below already targets the swapped base (`New base`), so the fixture's initial base string does not matter:

```ts
describe(`soul`, () => {
  it(`prepends the soul above the base system prompt on init`, async () => {
    const opts = baseOpts()
    opts.soul = `You are the ThreadedStack steward.`
    const handle = await AgentRunner.run(opts)
    await handle.waitForIdle()
    const ctorArgs = vi.mocked(Agent).mock.calls[0][0]
    expect(ctorArgs.initialState.systemPrompt).toBe(
      `You are the ThreadedStack steward.\n\nYou are a helpful assistant`
    )
  })

  it(`keeps the soul above a system prompt swapped via updateConfig`, async () => {
    const runner = new AgentRunner()
    const init = baseInitOpts()
    init.soul = `SOUL`
    await runner.init(init)
    runner.updateConfig({ systemPrompt: `New base` })
    const agentInstance = vi.mocked(Agent).mock.results[0]?.value
    expect(agentInstance.state.systemPrompt).toBe(`SOUL\n\nNew base`)
    await runner.destroy()
  })
})
```

(The existing `initialState` equality test and the `updateConfig` systemPrompt test stay green: with no `soul`, `[undefined, base].filter(Boolean).join('\n\n')` equals `base`.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd repos/agent && pnpm test src/runner/runner.test.ts`
Expected: FAIL (`opts.soul` is ignored; systemPrompt equals the base only).

- [ ] **Step 3: Add `soul` to the init opts type**

In `repos/agent/src/types/runner.types.ts`, add to `TAgentInitOpts` (next to `skills?`):

```ts
  /** Skills attached to this agent */
  skills?: Skill[]
  /** Durable identity/constitution, pinned to the top of the system prompt */
  soul?: string
```

- [ ] **Step 4: Store and compose the SOUL in the runner**

In `repos/agent/src/runner/runner.ts`:

Add a `#soul` field next to `#baseSystemPrompt` (line 55-56):

```ts
  #agent: Agent | null = null
  #baseSystemPrompt: string = ``
  #soul: string = ``
```

Add a private compose helper (place it as a private method on the class, e.g. just below the field declarations):

```ts
  #composeSystemPrompt(base: string): string {
    return [this.#soul, base].filter(Boolean).join(`\n\n`)
  }
```

In `init()`, set `#soul` before building `initialState`, and compose both the `initialState.systemPrompt` and `#baseSystemPrompt` from it. Replace the current line that reads `systemPrompt: llmConfig.systemPrompt || \`\`` (line 173) and the line `this.#baseSystemPrompt = llmConfig.systemPrompt || \`\`` (line 179). Introduce the composed value before the `new Agent({...})` call:

```ts
    this.#soul = opts.soul || ``
    const composedSystemPrompt = this.#composeSystemPrompt(llmConfig.systemPrompt || ``)
```

```ts
      initialState: {
        model: this.#model,
        tools: agentTools,
        messages: history as Message[],
        systemPrompt: composedSystemPrompt,
        ...(thinkingLevel && thinkingLevel !== `off` ? { thinkingLevel } : {}),
      },
```

```ts
    // 7b. Store the base system prompt (soul + base) for per-turn skill resolution
    this.#baseSystemPrompt = composedSystemPrompt
```

In `updateConfig()`, recompose so a system-prompt swap never drops the SOUL. Replace the current block at line 416-419:

```ts
    if (config.systemPrompt !== undefined) {
      this.#baseSystemPrompt = this.#composeSystemPrompt(config.systemPrompt)
      this.#agent.state.systemPrompt = this.#baseSystemPrompt
    }
```

In `destroy()`, reset `#soul` next to the existing `#baseSystemPrompt` reset (line 492):

```ts
    this.#baseSystemPrompt = ``
    this.#soul = ``
```

- [ ] **Step 5: Run the tests and type-check**

Run: `cd repos/agent && pnpm test src/runner/runner.test.ts`
Expected: PASS (new soul tests pass; existing systemPrompt tests remain green).
Run: `cd repos/agent && pnpm types`
Expected: PASS

- [ ] **Step 6: Stage (user commits)**

```bash
git add repos/agent/src/types/runner.types.ts repos/agent/src/runner/runner.ts repos/agent/src/runner/runner.test.ts
```
Commit message: `feat(agent): pin the agent soul to the top of the system prompt`

---

## Task 4: Thread the SOUL through the backend into every runner init

**Files:**
- Modify: `repos/backend/src/types/agent.types.ts:29-39`
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts:145-158`
- Modify: `repos/backend/src/services/endpoints/agentEndpoint.ts:103-118`
- Modify: `repos/backend/src/services/websocket/websocket.ts:99-118`
- Modify: `repos/backend/src/endpoints/agents/updateAgent.ts:20-36,120-135`

- [ ] **Step 1: Add `soul` to the shared runtime config type**

In `repos/backend/src/types/agent.types.ts`, add `soul` to `TAgentRuntimeConfig` (shared by `TResolvedAgentConfig` and `TSession`, so both the headless and WebSocket paths carry it):

```ts
export type TAgentRuntimeConfig = {
  skills: Skill[]
  tools?: string[]
  soul?: string
  db: IAgentRunnerDB
  customFunctions: Function[]
  llmConfig: TLLMAdapterConfig
  sandboxConfig: TSandboxConfig
  environment?: TAgentEnvironment
  envVars: Record<string, string>
  onExecuteFunction: TFunctionExecutionHandler
}
```

- [ ] **Step 2: Return `soul` from resolveAgentConfig**

In `repos/backend/src/utils/agent/resolveAgentConfig.ts`, add `soul` to the returned object (the `return { ... }` block at line 145-158):

```ts
  return {
    agent,
    soul: effectiveAgent.soul,
    llmConfig,
    sandboxConfig,
    effectiveAgent,
    customFunctions,
    onExecuteFunction,
    orgId: agent.orgId,
    skills: skills || [],
    db: createDBAdapter(db),
    environment: effectiveAgent.environment,
    envVars: (effectiveAgent.envVars as Record<string, string>) ?? {},
    tools: (overrides?.tools || effectiveAgent.tools) as string[] | undefined,
  }
```

- [ ] **Step 3: Forward `soul` on the SSE/headless path**

In `repos/backend/src/services/endpoints/agentEndpoint.ts`, add `soul` to the `AgentRunner.run({ ... })` call inside `runHeadless` (line 103-118):

```ts
    const handle = await AgentRunner.run({
      prompt,
      userId,
      agentId,
      onEvent,
      threadId,
      soul: config.soul,
      db: config.db,
      orgId: config.orgId,
      tools: config.tools,
      skills: config.skills,
      llmConfig: config.llmConfig,
      environment: config.environment,
      sandboxConfig: config.sandboxConfig,
      onExecuteFunction: config.onExecuteFunction,
      customFunctions: config.customFunctions || [],
    })
```

- [ ] **Step 4: Forward `soul` on the persistent WebSocket path**

In `repos/backend/src/services/websocket/websocket.ts`, add `soul` to the object returned by `#buildInitOpts` (line 100-117):

```ts
    return {
      threadId,
      db: session.db,
      soul: session.soul,
      tools: session.tools,
      orgId: session.orgId,
      userId: session.userId,
      skills: session.skills,
      agentId: session.agentId,
      llmConfig: session.llmConfig,
      environment: session.environment,
      sandboxConfig: session.sandboxConfig,
      customFunctions: session.customFunctions,
      onExecuteFunction: session.onExecuteFunction,
      onEvent: (event: TStreamEvent) => {
        if (this.abortController?.signal.aborted) return
        this.bridgeEventToWS(event)
      },
    }
```

- [ ] **Step 5: Accept `soul` + `autonomous` on agent update**

`createAgent.ts:22` passes new body fields through automatically (`const { secretIds, projectIds = [], providerInputs, ...agent } = req.body`), but `updateAgent.ts` builds the update object field-by-field, so without this step editing the SOUL after creation is silently dropped. In `repos/backend/src/endpoints/agents/updateAgent.ts`:

Add `soul` and `autonomous` to the top-level body destructure (lines 20-36):

```ts
    const {
      name,
      soul,
      model,
      tools,
      envVars,
      secretIds,
      maxTokens,
      autonomous,
      temperature,
      description,
      environment,
      instructions,
      systemPrompt,
      thinkingBudget,
      providerInputs,
      thinkingEnabled,
      projectIds = [],
    } = req.body
```

Add both to the `agentUpdate` builder (lines 120-135, alongside the existing `if (... !== undefined)` lines):

```ts
    if (soul !== undefined) agentUpdate.soul = soul
    if (autonomous !== undefined) agentUpdate.autonomous = autonomous
```

Do NOT add them to the project-override branch (lines 46-93): the SOUL is org-level identity, never a per-project override. `Agent.sanitize()` spreads `...this` (agent.ts:85-91), so both fields survive API responses without further edits.

- [ ] **Step 6: Type-check proves the SOUL threads end-to-end**

Run: `cd repos/backend && pnpm types`
Expected: PASS. Type-checking is the gate here because `soul` now flows through `TResolvedAgentConfig` and `TSession` into the typed init opts at both sites; the runtime behavior (SOUL prepended) is unit-tested in Task 3, and the executor path gets an explicit behavioral assertion in Task 9.

- [ ] **Step 7: Run the backend suite for regressions**

Run: `cd repos/backend && pnpm test`
Expected: PASS

- [ ] **Step 8: Stage (user commits)**

```bash
git add repos/backend/src/types/agent.types.ts repos/backend/src/utils/agent/resolveAgentConfig.ts repos/backend/src/services/endpoints/agentEndpoint.ts repos/backend/src/services/websocket/websocket.ts repos/backend/src/endpoints/agents/updateAgent.ts
```
Commit message: `feat(backend): thread the agent soul through resolveAgentConfig into every runner init`

---

## Task 5: Add `agentId` + continuity `threadId` to schedules

**Files:**
- Modify: `repos/database/src/schemas/schedules.ts`
- Modify: `repos/domain/src/models/schedule.ts:7`
- Test: `repos/domain/src/models/schedule.test.ts` (Create)

- [ ] **Step 1: Write the failing test**

Create `repos/domain/src/models/schedule.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { Schedule } from './schedule'

describe(`Schedule model`, () => {
  it(`carries agentId and threadId through the constructor`, () => {
    const s = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
      agentId: `ag_123`,
      threadId: `th_123`,
    })
    expect(s.agentId).toBe(`ag_123`)
    expect(s.threadId).toBe(`th_123`)
  })

  it(`leaves agentId and threadId undefined by default`, () => {
    const s = new Schedule({
      orgId: `org-1`,
      projectId: `pr-1`,
      sandboxId: `sb-1`,
      cronExpression: `0 * * * *`,
    })
    expect(s.agentId).toBeUndefined()
    expect(s.threadId).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd repos/domain && pnpm test src/models/schedule.test.ts`
Expected: FAIL (`agentId`/`threadId` are not declared on the model).

- [ ] **Step 3: Declare the fields on the Schedule model**

In `repos/domain/src/models/schedule.ts`, add two nullable fields next to `userId?: string` (line 7):

```ts
  userId?: string
  agentId?: string
  threadId?: string
```

- [ ] **Step 4: Add the columns to the schedules table**

In `repos/database/src/schemas/schedules.ts`:

Add imports for `agents` and `threads` next to the existing schema imports (top of file):

```ts
import { agents } from '@TDB/schemas/agents'
import { threads } from '@TDB/schemas/threads'
```

Add two nullable FK columns inside the table body, after the `userId` column (line 33). Both use `onDelete: 'set null'` because a deleted agent/thread must not cascade-delete the schedule:

```ts
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    agentId: varchar(`agent_id`, { length: 10 }).references(() => agents.id, {
      onDelete: `set null`,
    }),
    threadId: varchar(`thread_id`, { length: 10 }).references(() => threads.id, {
      onDelete: `set null`,
    }),
```

Add an index for `agentId` in the index array (after line 49):

```ts
    index(`schedules_enabled_next_run_idx`).on(table.enabled, table.nextRunAt),
    index(`schedules_agent_id_idx`).on(table.agentId),
```

Add the relations in `schedulesRelations` (after the `user` relation):

```ts
  user: one(users, {
    fields: [schedules.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [schedules.agentId],
    references: [agents.id],
  }),
  thread: one(threads, {
    fields: [schedules.threadId],
    references: [threads.id],
  }),
```

Note on the import cycle: `agents.ts` already imports `schedules`; adding the reverse import is safe because every reference is inside a lazy `() => agents.id` / `() => threads.id` callback (evaluated after module load), not at table-construction time.

- [ ] **Step 5: Run the test and type-checks**

Run: `cd repos/domain && pnpm test src/models/schedule.test.ts`
Expected: PASS
Run: `cd repos/domain && pnpm types && cd ../database && pnpm types`
Expected: PASS (`TDBScheduleSelect`/`TDBScheduleInsert` are inferred and update automatically; the schedule DB service `model()` spreads `...data`).

- [ ] **Step 6: Stage (user commits)**

```bash
git add repos/database/src/schemas/schedules.ts repos/domain/src/models/schedule.ts repos/domain/src/models/schedule.test.ts
```
Commit message: `feat(schedules): add agentId and continuity threadId to schedules`

---

## Task 6: Accept optional `agentId` on schedule create/update

**Files:**
- Modify: `repos/backend/src/endpoints/schedules/createSchedule.ts:31-79`
- Modify: `repos/backend/src/endpoints/schedules/updateSchedule.ts:27-78`
- Test: `repos/backend/src/endpoints/schedules/schedules.test.ts`

- [ ] **Step 1: Write the failing tests**

In `repos/backend/src/endpoints/schedules/schedules.test.ts`, extend the mock services returned by `buildMockReqRes()` to include an `agent` service (add alongside the existing `schedule`/`sandbox`/`project` services):

```ts
agent: { get: vi.fn() },
```

Then add these cases in the `createSchedule` describe block:

```ts
it(`accepts a valid agentId and passes it to schedule.create`, async () => {
  const { mockReq, mockRes, services } = buildMockReqRes()
  services.agent.get.mockResolvedValue({ data: { id: `ag_1`, orgId: `org-1` } })
  services.sandbox.get.mockResolvedValue({ data: { id: `sb-1`, orgId: `org-1` } })
  services.sandbox.getProjectConfig.mockResolvedValue({ data: {} })
  services.schedule.create.mockResolvedValue({ data: { id: `sd_1` } })
  mockReq.body = {
    agentId: `ag_1`,
    sandboxId: `sb-1`,
    prompt: `Review platform state`,
    cronExpression: `0 * * * *`,
  }
  await createSchedule.action(mockReq, mockRes)
  expect(services.schedule.create).toHaveBeenCalledWith(
    expect.objectContaining({ agentId: `ag_1` })
  )
  expect(mockRes.status).toHaveBeenCalledWith(201)
})

it(`rejects an agentId belonging to another org`, async () => {
  const { mockReq, mockRes, services } = buildMockReqRes()
  services.agent.get.mockResolvedValue({ data: { id: `ag_1`, orgId: `other-org` } })
  services.sandbox.get.mockResolvedValue({ data: { id: `sb-1`, orgId: `org-1` } })
  services.sandbox.getProjectConfig.mockResolvedValue({ data: {} })
  mockReq.body = {
    agentId: `ag_1`,
    sandboxId: `sb-1`,
    prompt: `x`,
    cronExpression: `0 * * * *`,
  }
  await expect(createSchedule.action(mockReq, mockRes)).rejects.toThrow(`Agent not found`)
})
```

And this case in the `updateSchedule` describe block (a changed agent must not inherit the previous agent's continuity thread; `existing` comes from the mocked `schedule.get`):

```ts
it(`clears the continuity threadId when agentId changes`, async () => {
  const { mockReq, mockRes, services } = buildMockReqRes()
  services.schedule.get.mockResolvedValue({
    data: {
      id: `sd_1`,
      orgId: `org-1`,
      projectId: `proj-1`,
      type: `prompt`,
      prompt: `x`,
      agentId: `ag_old`,
      threadId: `th_old`,
    },
  })
  services.agent.get.mockResolvedValue({ data: { id: `ag_new`, orgId: `org-1` } })
  services.schedule.update.mockResolvedValue({ data: { id: `sd_1` } })
  mockReq.params = { orgId: `org-1`, projectId: `proj-1`, scheduleId: `sd_1` }
  mockReq.body = { agentId: `ag_new` }
  await updateSchedule.action(mockReq, mockRes)
  expect(services.schedule.update).toHaveBeenCalledWith(
    expect.objectContaining({ agentId: `ag_new`, threadId: null })
  )
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd repos/backend && pnpm test src/endpoints/schedules/schedules.test.ts`
Expected: FAIL (`agentId` is not read/validated/persisted yet).

- [ ] **Step 3: Read, validate, and persist `agentId` in createSchedule**

In `repos/backend/src/endpoints/schedules/createSchedule.ts`, add `agentId` to the destructured body (line 31-39):

```ts
    const {
      prompt,
      command,
      enabled,
      agentId,
      sandboxId,
      cronExpression,
      maxConsecutiveErrors,
      type = EScheduleType.prompt,
    } = req.body
```

Add validation after the sandbox checks (after line 56, before the type/command/prompt checks):

```ts
    if (agentId) {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr) throw new Exception(500, agentErr.message)
      if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)
    }
```

Pass `agentId` into the `new Schedule({ ... })` (line 67-79):

```ts
    const schedule = new Schedule({
      orgId,
      type,
      prompt,
      command,
      agentId,
      nextRunAt,
      sandboxId,
      projectId,
      cronExpression,
      userId: req.user?.id,
      enabled: enabled ?? true,
      maxConsecutiveErrors: maxConsecutiveErrors ?? 5,
    })
```

- [ ] **Step 4: Support `agentId` in updateSchedule**

In `repos/backend/src/endpoints/schedules/updateSchedule.ts`, add `agentId` to the destructured body (line 27-35):

```ts
    const {
      type,
      prompt,
      command,
      enabled,
      agentId,
      sandboxId,
      cronExpression,
      maxConsecutiveErrors,
    } = req.body
```

Validate it when present (after the `sandboxId` block, before the type/prompt checks at line 50):

```ts
    if (agentId !== undefined && agentId !== null) {
      const { data: agent, error: agentErr } = await db.services.agent.get(agentId)
      if (agentErr) throw new Exception(500, agentErr.message)
      if (!agent || agent.orgId !== orgId) throw new Exception(404, `Agent not found`)
    }
```

Add it to the partial update spread (line 70-77), clearing the continuity thread whenever the agent changes (the fetched schedule is already available as `existing` from line 21). A schedule re-pointed at a new agent must NOT reuse the old agent's episodic thread, and clearing `agentId` (set to null) also clears the thread:

```ts
      ...(type !== undefined && { type }),
      ...(prompt !== undefined && { prompt }),
      ...(command !== undefined && { command }),
      ...(enabled !== undefined && { enabled }),
      ...(agentId !== undefined && { agentId }),
      ...(agentId !== undefined && agentId !== existing.agentId && { threadId: null }),
      ...(sandboxId !== undefined && { sandboxId }),
      ...(nextRunAt !== undefined && { nextRunAt }),
      ...(cronExpression !== undefined && { cronExpression }),
      ...(maxConsecutiveErrors !== undefined && { maxConsecutiveErrors }),
```

- [ ] **Step 5: Run the tests and type-check**

Run: `cd repos/backend && pnpm test src/endpoints/schedules/schedules.test.ts`
Expected: PASS
Run: `cd repos/backend && pnpm types`
Expected: PASS

- [ ] **Step 6: Stage (user commits)**

```bash
git add repos/backend/src/endpoints/schedules/createSchedule.ts repos/backend/src/endpoints/schedules/updateSchedule.ts repos/backend/src/endpoints/schedules/schedules.test.ts
```
Commit message: `feat(schedules): accept and validate optional agentId on create/update`

---

## Task 7: Admin UI — edit the SOUL/autonomous and create agent-backed schedules

Without this task the new fields are API-only: `AgentDrawer.tsx` builds an explicit `agentData` object (no spread), so `soul`/`autonomous` would be silently dropped, and `ScheduleDrawer.tsx` has no agent picker. The spec requires the SOUL to be "a plain editable admin field".

**Files:**
- Modify: `repos/admin/src/components/Agents/AgentDrawer.tsx:102-116,119-184,227-240`
- Modify: `repos/admin/src/components/Agents/AgentSettingsForm.tsx`
- Modify: `repos/admin/src/components/Schedules/ScheduleDrawer.tsx:54-77,103-110,189-197`
- Create: `repos/admin/src/components/Selectors/AgentSelector.tsx` (follow `SandboxSelector` in the same directory)
- Modify: `repos/admin/src/routes/loaders.ts:194-208` (`projectSchedulesLoader`)
- Modify: `repos/admin/src/types/sandbox.types.ts:18` (`TSandboxSchedule` gains `agentId?: string`; the optional field needs no `DefaultTemp` change)

- [ ] **Step 1: AgentDrawer — soul + autonomous**

In `repos/admin/src/components/Agents/AgentDrawer.tsx`:

1. Add form state next to the existing declarations (lines 102-116):
```ts
  const [soul, setSoul] = useState('')
  const [autonomous, setAutonomous] = useState(false)
```
2. Pre-populate and reset in the existing populate effect (lines 119-184): `setSoul(agent.soul || '')` / `setAutonomous(agent.autonomous ?? false)` in the `if (agent)` branch, and `setSoul('')` / `setAutonomous(false)` in the reset branch.
3. Add both to the `agentData` object (lines 227-240):
```ts
      const agentData = {
        name,
        soul,
        active,
        autonomous,
        maxTokens,
        description,
        systemPrompt,
        providerInputs,
        envVars: envVarsObj,
        tools: selectedTools,
        secretIds: selectedSecrets,
        projectIds: selectedProjectIds,
        functionIds: selectedFunctionIds,
        environment: buildEnvironment(),
      }
```
4. Render the SOUL editor in the drawer body directly above the existing System Prompt editor, using the exact same editor pattern (the drawer already imports `Code` + `MonacoOptions` for `systemPrompt`), labeled `Soul (Constitution)`. Render the `autonomous` toggle in `AgentSettingsForm.tsx` following the existing `active`/`streaming` `SwitchInput` pattern (thread `autonomous`/`setAutonomous` through its props the same way `active`/`setActive` are).
5. Do NOT add either field to the `isOverrideMode` `configData` branch (lines 242-259): the SOUL is org-level identity, never a per-project override.

- [ ] **Step 2: ScheduleDrawer — optional agent picker**

1. Create `AgentSelector.tsx` in `repos/admin/src/components/Selectors/`, copying the `SandboxSelector` pattern (same props shape: `agents`, `agentId`, `onChange`, `loading`, plus a `None` option since the field is optional).
2. In `repos/admin/src/routes/loaders.ts:194-208`, extend `projectSchedulesLoader`'s `Promise.all` with a third entry that fetches agents when the flag is on, mirroring the guard style used by `orgAgentsLoader` (line 173): `isFeatureEnabled('agents') && no agents in context ? safeFetch(() => fetchAgents({ orgId, projectId })) : Promise.resolve()`. Data loads in the loader, never in a component `useEffect` (project rule).
3. In `ScheduleDrawer.tsx`: add `agentId` to the temp state (`TSandboxSchedule` gains `agentId?: string`), populate it from `schedule.agentId` in the existing populate effect (lines 62-77), read agents via the `useOrgAgents()` selector (`@TAF/state/selectors:211`), and render the `AgentSelector` inside the Configuration section (below `SandboxSelector`, lines 189-197), gated by `isFeatureEnabled('agents')`. No validation: the field is optional.
4. Add `agentId` to the save payload (lines 103-110):
```ts
    const payload = cleanColl({
      type: temp.type,
      enabled: temp.enabled,
      agentId: temp.agentId,
      sandboxId: temp.sandboxId,
      cronExpression: temp.cronExpression,
      prompt: temp.type === EScheduleType.prompt ? temp.prompt : undefined,
      command: temp.type === EScheduleType.shell ? temp.command : undefined,
    })
```
Note `cleanColl` strips undefined, so schedules without an agent send no `agentId` key at all.

- [ ] **Step 3: Verify**

Run: `cd repos/admin && pnpm test`
Expected: PASS (extend existing component tests where the touched components already have them; the Playwright agent-drawer specs run in Task 11).
Run: `cd repos/admin && pnpm types`
Expected: PASS

- [ ] **Step 4: Stage (user commits)**

```bash
git add repos/admin/src/components/Agents/AgentDrawer.tsx repos/admin/src/components/Agents/AgentSettingsForm.tsx repos/admin/src/components/Schedules/ScheduleDrawer.tsx repos/admin/src/components/Selectors/ repos/admin/src/routes/loaders.ts repos/admin/src/types
```
Commit message: `feat(admin): edit agent soul/autonomous and attach agents to schedules`

---

## Task 8: Type the schedule executor on backend locals

**Files:**
- Modify: `repos/backend/src/types/backend.types.ts:20-30`

- [ ] **Step 1: Add the typed field**

In `repos/backend/src/types/backend.types.ts`, import the executor type and add it to `TBELocals`:

```ts
import type { TScheduleExecutor } from '@TBE/services/scheduler'
```

```ts
type TBELocals = TAppLocals<
  TBEConfig,
  TDatabase,
  PaymentsService,
  EmailService,
  TAuthHeaderObj,
  KubeClient,
  SandboxService
> & {
  s3: S3Service
  scheduleExecutor?: TScheduleExecutor
}
```

The import is type-only (`import type`), so it is erased at runtime and does not create a require cycle even though `@TBE/services/scheduler` transitively imports `@TBE/types`.

- [ ] **Step 2: Type-check**

Run: `cd repos/backend && pnpm types`
Expected: PASS (`setupScheduler.ts` assigning `app.locals.scheduleExecutor` and `triggerSchedule.ts` reading it are now strongly typed).

- [ ] **Step 3: Stage (user commits)**

```bash
git add repos/backend/src/types/backend.types.ts
```
Commit message: `refactor(backend): type scheduleExecutor on backend locals`

---

## Task 9: Branch to AgentRunner for agent-backed schedules (the heartbeat wiring)

This task adds an agent-brain branch to the executor and leaves the existing pod-CLI path exactly as-is. Do it with the surgical edits below (do not rewrite the whole file).

**Files:**
- Modify: `repos/backend/src/services/scheduler/executor.ts`
- Test: `repos/backend/src/services/scheduler/executor.test.ts` (Create)

- [ ] **Step 1: Write the failing tests**

Create `repos/backend/src/services/scheduler/executor.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const runMock = vi.fn()
vi.mock(`@tdsk/agent`, () => ({
  AgentRunner: { run: (...args: unknown[]) => runMock(...args) },
}))

const resolveAgentConfigMock = vi.fn()
vi.mock(`@TBE/utils/agent/resolveAgentConfig`, () => ({
  resolveAgentConfig: (...args: unknown[]) => resolveAgentConfigMock(...args),
}))

import { createScheduleExecutor } from './executor'

const buildApp = () => {
  const services = {
    scheduleRun: {
      create: vi.fn().mockResolvedValue({ data: { id: `run-1` } }),
      complete: vi.fn().mockResolvedValue({}),
    },
    thread: { create: vi.fn().mockResolvedValue({ data: { id: `th_new` } }) },
    schedule: { update: vi.fn().mockResolvedValue({}) },
  }
  const s3 = {
    createUploadStream: vi.fn(() => ({
      stream: { write: vi.fn(), end: vi.fn() },
      done: vi.fn().mockResolvedValue(undefined),
    })),
  }
  const sandbox = { stopPod: vi.fn().mockResolvedValue(undefined) }
  return {
    services,
    app: { locals: { db: { services }, sandbox, s3, config: { egress: {} } } } as any,
  }
}

const agentSchedule = (overrides: Record<string, unknown> = {}) => ({
  id: `sd_1`,
  orgId: `org-1`,
  userId: `us_1`,
  projectId: `pr-1`,
  sandboxId: `sb-1`,
  agentId: `ag_1`,
  prompt: `Review platform state`,
  cronExpression: `0 * * * *`,
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  resolveAgentConfigMock.mockResolvedValue({
    orgId: `org-1`,
    soul: `SOUL`,
    db: {},
    skills: [],
    tools: [],
    customFunctions: [],
    environment: {},
    llmConfig: { model: `m`, provider: `anthropic` },
    sandboxConfig: { provider: `local` },
    onExecuteFunction: vi.fn(),
  })
  runMock.mockResolvedValue({ waitForIdle: vi.fn().mockResolvedValue(undefined) })
})

describe(`createScheduleExecutor — agent-backed schedule`, () => {
  it(`runs the agent with the soul, prompt, and a new continuity thread`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule() as any)

    expect(runMock).toHaveBeenCalledTimes(1)
    const runArgs = runMock.mock.calls[0][0]
    expect(runArgs.soul).toBe(`SOUL`)
    expect(runArgs.prompt).toBe(`Review platform state`)
    expect(runArgs.agentId).toBe(`ag_1`)
    expect(runArgs.threadId).toBe(`th_new`)
    expect(services.schedule.update).toHaveBeenCalledWith({
      id: `sd_1`,
      threadId: `th_new`,
    })
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `success` })
    )
  })

  it(`reuses an existing continuity thread and does not create a new one`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await executor(agentSchedule({ threadId: `th_existing` }) as any)

    expect(services.thread.create).not.toHaveBeenCalled()
    expect(runMock.mock.calls[0][0].threadId).toBe(`th_existing`)
  })

  it(`records an error when an agent-backed schedule has no prompt`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await expect(
      executor(agentSchedule({ prompt: undefined }) as any)
    ).rejects.toThrow(/no prompt/)
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })

  it(`records an error when an agent-backed schedule has no userId`, async () => {
    const { app, services } = buildApp()
    const executor = createScheduleExecutor(app)
    await expect(
      executor(agentSchedule({ userId: undefined }) as any)
    ).rejects.toThrow(/no userId/)
    expect(services.thread.create).not.toHaveBeenCalled()
    expect(services.scheduleRun.complete).toHaveBeenCalledWith(
      `run-1`,
      expect.objectContaining({ status: `error` })
    )
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd repos/backend && pnpm test src/services/scheduler/executor.test.ts`
Expected: FAIL (the current executor never calls `resolveAgentConfig`/the runner).

- [ ] **Step 3: Add imports for the agent path**

In `repos/backend/src/services/scheduler/executor.ts`, extend the import block. Add `TStreamEvent` to the `@tdsk/domain` type import, add a `TDatabase` type import, and add value imports for the runner and config resolver. After this edit the top of the file reads:

```ts
import type { TApp } from '@TBE/types'
import type { TDatabase } from '@tdsk/database'
import type { TScheduleExecutor } from '@TBE/services/scheduler/scheduler'
import type {
  Schedule,
  TStreamEvent,
  TKubeSandboxConfig,
  TSandboxRuntimeId,
} from '@tdsk/domain'

import { AgentRunner } from '@tdsk/agent'
import { logger } from '@TBE/utils/logger'
import { ExecTimeoutMS } from '@TBE/constants/sandbox'
import { EScheduleType, SandboxRuntimeConfigs } from '@tdsk/domain'
import { resolveAgentConfig } from '@TBE/utils/agent/resolveAgentConfig'
```

- [ ] **Step 4: Add three helper functions above `createScheduleExecutor`**

Insert these functions immediately after the existing `resolveScheduleCommand` function and immediately before `export function createScheduleExecutor`:

```ts
/** Race a promise against the shared execution timeout. */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms / 1000}s`)), ms)
    timer.unref()
  })
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer!))
}

/**
 * Resolve the durable continuity thread for an agent-backed schedule.
 * Reuses schedule.threadId when set; otherwise creates one and persists it
 * back onto the schedule so subsequent heartbeats share the same episodic thread.
 */
async function resolveContinuityThread(
  db: TDatabase,
  schedule: Schedule,
  orgId: string
): Promise<string> {
  if (schedule.threadId) return schedule.threadId

  const { data: thread, error } = await db.services.thread.create({
    orgId,
    userId: schedule.userId,
    agentId: schedule.agentId,
    projectId: schedule.projectId,
    name: `Heartbeat ${schedule.id}`,
  })
  if (error || !thread)
    throw new Error(`Failed to create continuity thread: ${error?.message || 'unknown'}`)

  const { error: updErr } = await db.services.schedule.update({
    id: schedule.id,
    threadId: thread.id,
  })
  if (updErr)
    logger.error(
      `[Executor] Failed to persist continuity thread ${thread.id} on schedule ${schedule.id}: ${updErr.message}`
    )

  return thread.id
}

/**
 * Agent-brain execution path: resolve the agent's config and run the agent
 * against the durable continuity thread, streaming events to stdout.
 * Returns the started pod name (if any) so the caller can tear it down.
 */
async function runAgentSchedule(
  app: TApp,
  schedule: Schedule,
  onStdout: (chunk: string) => void
): Promise<{ instanceId?: string }> {
  const { db } = app.locals

  if (!schedule.agentId) throw new Error(`runAgentSchedule called without agentId`)
  if (!schedule.prompt)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no prompt`)
  // threads.user_id is NOT NULL while schedules.user_id is nullable (onDelete: set null),
  // so a missing user must fail loudly here, not as a raw DB constraint error mid-run.
  if (!schedule.userId)
    throw new Error(`Schedule ${schedule.id} is agent-backed but has no userId`)

  const config = await resolveAgentConfig(schedule.agentId, db, app, {
    userId: schedule.userId,
    projectId: schedule.projectId,
  })

  const threadId = await resolveContinuityThread(db, schedule, config.orgId)

  const handle = await AgentRunner.run({
    prompt: schedule.prompt,
    userId: schedule.userId || ``,
    agentId: schedule.agentId,
    threadId,
    soul: config.soul,
    db: config.db,
    orgId: config.orgId,
    tools: config.tools,
    skills: config.skills,
    llmConfig: config.llmConfig,
    environment: config.environment,
    sandboxConfig: config.sandboxConfig,
    onExecuteFunction: config.onExecuteFunction,
    customFunctions: config.customFunctions || [],
    onEvent: (event: TStreamEvent) => onStdout(`${JSON.stringify(event)}\n`),
  })

  await handle.waitForIdle()

  return { instanceId: config.sandboxConfig?.options?.podName as string | undefined }
}
```

- [ ] **Step 5: Branch to the agent path at the top of the try block**

Inside `createScheduleExecutor`, at the very start of the `try {` block (immediately after `try {`, and before the existing `instanceId = await sandbox.startPod({ ... })` line), insert the early-return agent branch. Everything below it (the existing pod-CLI path, the `catch`, and the `finally`) stays exactly as it is:

```ts
    try {
      if (schedule.agentId) {
        const agentRun = await withTimeout(
          runAgentSchedule(app, schedule, (chunk) =>
            stdoutUpload?.stream.write(chunk)
          ),
          ExecTimeoutMS
        )
        instanceId = agentRun.instanceId

        const uploadOk = await finalizeUploads()
        const { error: completeErr } = await db.services.scheduleRun.complete(run.id, {
          instanceId,
          durationMs: Date.now() - start,
          status: `success`,
          ...(uploadOk && { stdoutKey, stderrKey }),
        })
        if (completeErr)
          logger.error(
            `[Executor] Failed to write completion record for run ${run.id} (schedule ${schedule.id}): ${completeErr.message}`
          )
        else markedComplete = true

        logger.info(
          `[Executor] Schedule ${schedule.id} — agent run completed in ${Date.now() - start}ms`
        )
        return
      }

      // ---- existing pod-CLI path continues unchanged below ----
```

The early `return` still runs the existing `finally` block, which tears down `instanceId` (the pod the agent started, when the agent uses a K8s body) via `app.locals.sandbox?.stopPod(instanceId)`. When the agent uses a local body, `instanceId` is `undefined` and teardown is skipped. On any error, `runAgentSchedule` rejects and the existing `catch` records the run as `error`/`timeout`.

IMPORTANT constraint on heartbeat agents: the agent's `environment` must use `sandboxId` (a Sandbox config row), NOT `instanceId` (a running-pod pointer). With `sandboxId`, `resolveAgentConfig` starts a fresh pod per heartbeat (`resolveAgentConfig.ts:111-119`) and the teardown above correctly disposes it. With `instanceId`, the resolved podName points at a long-lived pod that this `finally` would kill; additionally, agent execs never refresh the idle-reaper's activity clock, so a "persistent" pod would be reaped ~30 minutes after start anyway. Fresh pod per heartbeat is the supported model (it also matches the fresh-context-per-cycle discipline: the entrypoint re-clones the repo on every start).

- [ ] **Step 6: Run the executor tests to verify they pass**

Run: `cd repos/backend && pnpm test src/services/scheduler/executor.test.ts`
Expected: PASS

- [ ] **Step 7: Run the scheduler tests and type-check**

Run: `cd repos/backend && pnpm test src/services/scheduler/scheduler.test.ts`
Expected: PASS (the `Scheduler` calls the executor callback opaquely; the branch does not change its interface).
Run: `cd repos/backend && pnpm types`
Expected: PASS

- [ ] **Step 8: Stage (user commits)**

```bash
git add repos/backend/src/services/scheduler/executor.ts repos/backend/src/services/scheduler/executor.test.ts
```
Commit message: `feat(scheduler): branch agent-backed schedules through the agent brain with a continuity thread`

---

## Task 10: Apply the migration, verify green, and bring the agent to life

**Files:** none (schema push + runtime bring-up on the live environment)

- [ ] **Step 1 (USER, manual): apply the schema**

The user runs this from `repos/database` (interactive `drizzle-kit push`; Claude cannot run it). All four new columns (`agents.soul`, `agents.autonomous`, `schedules.agent_id`, `schedules.thread_id`) are nullable/defaulted, so it applies without a destructive prompt:

```bash
cd repos/database && pnpm push
```
Expected: the four columns are added; no "data loss" prompt appears. If a destructive prompt appears, stop and investigate (nothing in this plan drops or renames a column).

- [ ] **Step 2: Full green verification across repos**

Run: `cd /Users/lancetipton/keg-hub/external/apps/threadedstack && pnpm types`
Expected: PASS
Run: `pnpm test`
Expected: PASS. Fix any failure fully before proceeding (do not mark any failure "pre-existing"; run it down).

- [ ] **Step 3: Seed agent instance #1 (the ThreadedStack Steward)**

On the running environment (K8s up, admin dev server up), via the admin UI (Task 7 made `soul`/`autonomous`/agent-picker editable there) or the `/_/orgs/:orgId/...` API.

Do NOT use a `local` sandbox body: LocalSandbox is a pure in-memory FS with no network and no real files (`repos/sandbox/src/local/local.ts:157-200`), so a local-bodied agent is blind; it cannot observe the repo, health endpoints, or anything else. The P0 agent gets a K8s body with the ThreadedStack repo cloned read-only.

1. Ensure an AI Provider exists for the org with a valid secret (API key), e.g. an Anthropic provider. This is the agent's brain. This is a hard prerequisite, not a nicety: `resolveAgentConfig` throws `404 Agent has no provider configured` without the `agent_providers` link and `400 No API key found for agent provider` without a decryptable secret (`resolveAgentConfig.ts:63,68`), so the heartbeat fails before any LLM call.
2. Create the observation body (project + repo + sandbox):
   - A "platform" project (or reuse one) that the heartbeat schedule will live under.
   - A GitHub git provider with `options.repoUrl` = the ThreadedStack repo and a `secretId` pointing at a READ-ONLY fine-grained PAT (`contents:read` on that repo only) stored as an encrypted secret. The token reaches the pod only as an egress MITM placeholder (`resolveGitProviderEnv.ts`), never in plaintext.
   - A sandbox (claudeCode runtime, standard image) linked to the project, with the git provider junction so the pod entrypoint auto-clones the repo into `/workspace` on start (`deploy/sandbox-entrypoint.sh:27-64`). Git provider links are project-scoped (`sandbox.ts:264`), so the clone only happens because the schedule carries this `projectId`.
3. Create the agent (`POST /_/orgs/:orgId/agents`) with:
   - `name`: `ThreadedStack Steward`
   - `autonomous`: `true`
   - `soul`: a starter constitution, for example:
     > You are the ThreadedStack Steward, the autonomous agent that owns and improves the ThreadedStack platform. Your priority order, highest first: (1) stay safe and preserve human oversight; (2) be honest and never fabricate; (3) follow the project's guidelines; (4) be maximally useful in advancing the platform. In this phase you are read-only: observe and report, never modify code, data, or infrastructure. Ground every claim in evidence you can point to.
   - `tools`: `["shellExec", "readFile", "listDir", "fileExists"]`. Set the list explicitly: an undefined or EMPTY `tools` list grants ALL tools including `writeFile`, `deleteFile`, and `evalCode` (`repos/agent/src/tools/tools.ts:303-304` returns everything when `allowedTools` is falsy or empty). `shellExec` is required for the agent to observe anything (git log, grep, curl); read-only is NOT enforced by the tool list. It is enforced by credential scope and disposability: the PAT is `contents:read`, pod push auth is not wired at all today (the clone token is a one-shot header, never persisted), the pod mounts no service-account token (`podManifest.ts:104`, `automountServiceAccountToken: false`), holds no other secrets, and is torn down at the end of each run. The SOUL's read-only clause is the behavioral backstop.
   - a provider link (`agent_providers`) to the provider from step 1
   - `environment.sandboxType`: `kubernetes` and `environment.sandboxId`: the sandbox from step 2. Use `sandboxId`, never `environment.instanceId` (see the Task 9 note: fresh pod per heartbeat, torn down by the executor).
4. Create the hourly heartbeat schedule (`POST /_/orgs/:orgId/projects/:projectId/schedules`, using the platform project from step 2) with:
   - `agentId`: the agent id from step 3
   - `type`: `prompt`
   - `prompt`: `You wake up hourly. Your workspace at /workspace contains a fresh read-only clone of the ThreadedStack repo. 1) Summarize what changed since your previous report (use git log; compare against the last report in this thread). 2) Check service health with curl against the public endpoints (/health and /_/health on the environment domain) and report status. 3) Flag anything notable or anomalous, citing the evidence (commits, output). You are read-only: never modify code, data, or infrastructure, and never push.`
   - `cronExpression`: `0 * * * *`
   - `sandboxId`: the same sandbox from step 2 (required by the schema; the agent's own `environment` also points at it)

- [ ] **Step 4: Confirm the heartbeat drives the brain**

Trigger the schedule immediately instead of waiting for the hour:

```bash
# through Caddy -> Proxy (requires a valid bearer token)
curl -s -X POST -H "Authorization: Bearer <token>" \
  https://local.threadedstack.app/_/orgs/<orgId>/projects/<projectId>/schedules/<scheduleId>/trigger
```
Expected verification:
1. A `schedule_runs` row is created and completes with `status: success`.
2. A continuity thread was created (the schedule now has `thread_id` set); triggering a second time reuses it and does NOT create a new thread.
3. The thread contains the agent's assistant message with REAL observed content: actual commit hashes/messages from `git log` and actual HTTP statuses from the health checks, not fabricated summaries. It reflects the SOUL (identity/read-only posture). Confirm via the thread's messages or the admin UI.
4. Backend logs show `[Executor] Schedule <id> — agent run completed` and no pod-CLI command was run for this schedule (it went through the agent brain).
5. Tool calls in the thread are from the allowlist only (`shellExec`/`readFile`/`listDir`/`fileExists`; no `writeFile`/`deleteFile`/`evalCode`), and every `shellExec` command is observational (`git`, `ls`, `grep`, `cat`, `curl`); nothing mutates the repo or pushes.
6. A sandbox pod was started for the run and torn down when it completed (the executor's `finally` calls `stopPod`); no orphan pod remains (`kubectl get pods` or the sandbox sessions view).

Known accepted behavior (documented, not a defect): the executor creates the continuity thread and the runner persists messages via the db service layer, which bypasses the HTTP-only `enforceQuota` middleware (`enforceQuota.ts:12-29`). Heartbeat threads/messages therefore do not count against org quotas in P0; quota accounting for agent-generated resources is a later-phase concern.

- [ ] **Step 5: Validate multi-instance composition (agent #2)**

The steward is instance #1 of many; the platform must support N agents composed purely from existing entities, with zero steward-specific code. Prove it: seed a second agent through the exact same API surface:

1. Create a second agent (`POST /_/orgs/:orgId/agents`) with a distinct `name` (e.g. `Docs Scribe`), a distinct `soul` (any short constitution), `autonomous: true`, the same (or another) provider link, and default `environment` (`local` body; blind by design, which is fine here).
2. Create a second schedule bound to it (`agentId` = agent #2, any project/sandbox, `cronExpression`: `0 9 * * *`, prompt: `State your identity and purpose in one paragraph.`).
3. Trigger agent #2's schedule, then verify:
   - Agent #2 gets its OWN continuity thread (different `thread_id` than the steward's schedule; both schedules retain their respective threads on re-trigger).
   - Agent #2's thread reflects ITS soul, not the steward's; the steward's thread is untouched (no cross-contamination in either direction).
   - No code was changed to make agent #2 work: both agents are pure DATA (rows) flowing through the same executor branch, prompt assembly, and thread continuity.

This check validates multi-instance isolation and composition-from-existing-entities (per spec section 9's "no bespoke code for instance #1" invariant), not observation quality; agent #2's report content is expected to be trivial.

- [ ] **Step 6: Stage any seed helper (if you created one); otherwise nothing to commit**

If bring-up was done purely via API/admin (recommended), there is no code to commit for this task. If you wrote a seed helper, stage it:
```bash
git add <seed-file>
```
Commit message: `chore(agent): seed the ThreadedStack Steward agent and hourly heartbeat`

---

## Task 11: Full tier1 integration green on live K8s

Flipping the `agents` flag activates ~20 previously skipped integration suites (`describe.skipIf(!isFeatureEnabled('agents'))`): tier1 `agents.test.ts`, `agent-project-config`, `agent-functions`, `agent-provider-models`, `agent-providers`, `sessions`, `messages`, `thread-write-ops`, `thread-file-upload`, `ws-file-upload`, `session-auth`, `web-tools-config`, `project-state-scoping`, `tsa-chatlogic-state`, `tsa-project-flow`, conditional cases in `project-membership-enforcement` and `role-permission-matrix`, plus tier3 agent-execution suites. These have not run since the flag went off; this task owns making the full tier1 suite green, not just the suites this plan touched.

**Files:** whatever the failures require (test updates for drifted behavior, or product fixes for real regressions)

- [ ] **Step 1: Run the full tier1 suite**

From `repos/integration` against live K8s (services already running). Use the real `TDSK_IT_*` env keys; NEVER fake API keys, and NEVER DELETE/PUT seeded org resources in tests.

Run: `cd repos/integration && pnpm test`
Expected: failures on first run are likely (latent suites). Save output for triage.

- [ ] **Step 2: Fix every failure**

Fix ALL failures; do not triage any as "pre-existing" and move on. For each: determine whether the test encodes stale flag-off expectations (update the test) or has found a real regression (fix the product code). The updated `direct-paths.test.ts` from Task 1 and `schedule-lifecycle.test.ts` (which hard-asserts `sandboxId` required at line 106; this plan keeps sandboxId required, so it must stay green) are the two known-sensitive files.

- [ ] **Step 3: Re-run to green**

Run: `cd repos/integration && pnpm test`
Expected: PASS, full suite.

- [ ] **Step 4: Playwright agent specs**

With the admin dev server up (`cd repos/admin && pnpm start`):
Run: `cd repos/integration && pnpm test:ui`
Expected: PASS, including the now-active agent drawer/CRUD specs (they exercise the Task 7 UI changes).

- [ ] **Step 5: Stage (user commits)**

```bash
git add repos/integration
```
Commit message: `test(integration): re-activate and green the agent suites after enabling the agents flag`

---

## Self-review (plan author + independent codebase audit 2026-07-01)

**Spec coverage (P0 section of the design spec):**
- "Turn the `agents` flag ON" -> Task 1 (including the flip's blast radius: admin nav restriction + nav tests + integration flag-off assertion).
- "add the `soul` field and the formalized prompt-assembly order" -> Task 2 (field), Task 3 (SOUL pinned first in the runner; per-turn skill rebuilds compose onto `#baseSystemPrompt`, so SOUL -> base -> skills order holds every turn), Task 4 (threaded through the backend, including updateAgent acceptance).
- "add `agentId` plus continuity `threadId` to `schedules`" -> Task 5 (schema+model), Task 6 (endpoints, incl. thread clearing on agent change), Task 7 (admin UI).
- "rewire the executor to invoke the agent brain against the continuity thread" -> Task 9.
- "an hourly heartbeat run that reads state and reports, no writes" -> Task 10; the agent is embodied in a K8s pod with the ThreadedStack repo cloned read-only, and "no writes" is enforced by credential scope (read-only `contents:read` PAT, no wired push auth, no SA token, no other secrets) plus per-run pod disposal, with an explicit tool allowlist (`tools.ts:303-304` grants ALL tools when the list is empty) and the SOUL as behavioral backstop.
- Deliverable "a 24/7 monitoring/reporting agent" -> Task 10 bring-up, Task 11 full integration green.

**Intentional spec deviations (recorded, not gaps):**
- The spec's "ship the SOUL as an `alwaysActive` skill" is NOT done; pinning the SOUL in the runner's prompt composition is strictly stronger (it cannot be dropped by skill retrieval), so the skill duplication is skipped.
- `schedules.sandboxId` stays required/NOT NULL: avoids a migration, and `schedule-lifecycle.test.ts:106` hard-asserts it; the agent's own `environment` drives its actual body.
- No new `EScheduleType` member; the `agentId` column is the discriminator for agent-backed schedules.

**Audit corrections applied (verified against the codebase):**
- `updateAgent.ts` builds its update object field-by-field; without Task 4 Step 5 the SOUL would be un-editable after creation (createAgent passes it via `...agent` spread; `Agent.sanitize()` spreads `...this` so responses keep it).
- `threads.userId` is `uuid NOT NULL` while `schedules.userId` is nullable (`set null` on user delete): Task 9 guards agent-backed runs with a clear error before thread creation.
- No backend unit test asserts agents-off; the real flip breakage is `nav.test.tsx:438` and `direct-paths.test.ts:85` (Task 1) plus the latent skipIf suites (Task 11). `nav.test.tsx:269` stays green because org-level Agents nav is now admin-restricted.
- A schedule re-pointed at a different agent clears its continuity `threadId` (Task 6) so agents never inherit another agent's episodic thread.
- Heartbeat thread/message creation bypasses HTTP-layer quotas; documented as accepted P0 behavior in Task 10.
- `baseInitOpts()` in `runner.test.ts` is a per-describe local fixture, not shared; Task 3's tests are placed accordingly.
- A `local`-bodied agent is blind: LocalSandbox is a pure in-memory FS (no disk bridge, no network, `curl` absent), and `webFetch` routes via the third-party `r.jina.ai` reader which blocks internal hosts. Task 10 therefore embodies the P0 agent in a K8s pod with the repo cloned read-only; the local sandbox is safe (fully confined) but unusable for observation.
- Multi-instance by construction: P0 introduces ZERO steward-specific code. Every change is a generic capability (`agents.soul`/`autonomous` columns, `schedules.agentId` FK, the executor's agent branch keyed on `schedule.agentId`, generic admin forms); the steward is pure data composed from existing entities (agent_providers brain, sandbox body, agent_skills learning, schedules heartbeat, threads memory, soul identity). Task 10 Step 5 proves it by seeding agent #2 through the same API and verifying isolated continuity threads.
- End-state autonomy: P0's read-only posture and the human-run interactive `pnpm push` are implementation-time/interim elements only; per the spec's end-state autonomy contract (section 7.1), P1 introduces the executable CI merge gate (no human merges at any phase), P4 removes the manual deploy/migration steps, and after P5 the only human touchpoints are the one-time seed and optional escalation response.
- Agent-path pods are never torn down by the runner (`KubeSandbox.close()` is a no-op) and agent execs do not refresh the idle-reaper clock; the heartbeat relies on the executor's `finally` teardown, which is why `environment.sandboxId` (fresh pod per run) is required and `environment.instanceId` is forbidden (Task 9 note).

**Placeholder scan:** no TBD/TODO; every code step shows real code; every run step shows the exact command and expected result. Bring-up (Task 10) is a runbook because it is runtime data on the live environment, not code; it lists exact endpoints, payload fields, and verification checks.

**Type consistency:** `soul` is added to `TAgentInitOpts` (agent), `TAgentRuntimeConfig` (backend), the `Agent` model (domain), and the `agents` column; it flows `resolveAgentConfig -> config.soul -> AgentRunner.run({ soul }) / #buildInitOpts({ soul }) -> runner init`. `agentId`/`threadId` are added to the `schedules` column, the `Schedule` model, the create/update endpoints, the admin drawer payloads, and consumed in the executor (`schedule.agentId`, `schedule.threadId`). `withTimeout`, `resolveContinuityThread`, and `runAgentSchedule` are all defined in Task 9's executor edits. All FK columns use `varchar(10)` matching `entityId` (`agents.id`/`threads.id` are varchar(10), NOT uuid; only `users.id` is uuid).

**Scope:** P0 only. It produces working, testable software on its own (a live read-only heartbeat agent observing the real repo and services). The follow-on phases were resequenced on 2026-07-01 so the agent starts working on the codebase sooner: P1 (autonomous PR author: in-pod push auth via the existing MITM placeholder, promptCommand autonomy flags via per-sandbox override, `gh` CLI in the sandbox image, parameterized exec timeout; merges are gated by a NEW `.github/workflows/ci.yml` running `pnpm types` + `pnpm test` on PRs (no PR CI exists today) plus branch protection, and the agent lands its own PR via `gh pr merge --auto` when green; NO human merge; git + the continuity thread are the memory), P2 (pgvector memory + self-direction), P3 (formal delegation + self-improvement), P4 (delivery spine), and P5 (full ownership) are separate plans that build on this. Per the spec's end-state autonomy contract (section 7.1), no phase introduces a required human step, and once P5 lands the only human touchpoints are the one-time seed and optional escalation response. See the design spec section 11.
