# OAI-Compatible API — PR Review Fixes

## Goal

Fix all 14 issues identified in the PR review for the OpenAI-compatible API implementation. Normalize duplicate type definitions, relocate inline types to proper directories, fix critical bugs, improve error handling, and add missing test coverage.

## Scope

This spec covers changes across 3 repos (`backend`, `domain`, `integration`) touching types, error handling, and tests. No new features — only fixes and normalization of existing code.

---

## 1. Type Normalization

### 1A. Override Type Hierarchy (Issue #11)

**Problem:** Three independent override types declare the same fields (`model`, `tools`, `maxTokens`, `temperature`, `systemPrompt`) without referencing each other. Adding a new common override field requires updating three places.

**Design:**

Define a base `TAgentOverrides` in domain, then derive specialized types via intersection:

```
domain/src/types/ai.types.ts:
  TAgentOverrides = { model?, tools?, maxTokens?, temperature?, systemPrompt? }
  TAgentRunOverrides = TAgentOverrides & { maxSteps? }

domain/src/types/epd.types.ts:
  TAgentEndpointConfig.overrides = TAgentOverrides & {
    functionIds?, providerIds?, secrets?, envVars?
  }

backend/src/types/agent.types.ts:
  TResolveAgentOpts.overrides = TAgentOverrides & { envVars? }
```

Each scope extends the base with only its extra fields. Structural typing allows passing a broader override object (e.g., `TAgentEndpointConfig.overrides`) where a narrower one is expected (e.g., `TResolveAgentOpts.overrides`).

**Note:** This intentionally adds `temperature` to `TAgentEndpointConfig.overrides` (via the base type) where it was previously absent. This is correct — endpoint configs should support all common LLM overrides.

**Files changed:**
- Modify: `repos/domain/src/types/ai.types.ts` — add `TAgentOverrides`, redefine `TAgentRunOverrides`
- Modify: `repos/domain/src/types/epd.types.ts` — redefine `TAgentEndpointConfig.overrides` to extend base
- Modify: `repos/backend/src/types/agent.types.ts` — import `TAgentOverrides`, redefine `TResolveAgentOpts.overrides`

### 1B. Runtime Config Base Type (Issue #10)

**Problem:** `TSession` and `TResolvedAgentConfig` share 12 fields. `resolveSession()` in `onWSConnect.ts` manually copies every field from one to the other — a maintenance trap where adding a field to one but forgetting the other causes silent data loss.

**Design:**

Extract shared fields into `TAgentRuntimeConfig` in backend types:

```
backend/src/types/agent.types.ts:
  TAgentRuntimeConfig = {
    llmConfig, sandboxConfig, environment?,
    customFunctions, functionMap, skills, tools?, envVars,
    db, onExecuteFunction
  }

  TResolvedAgentConfig = TAgentRuntimeConfig & {
    agent, effectiveAgent, orgId
  }

backend/src/types/session.types.ts:
  TSession = TSessionPayload & TAgentRuntimeConfig
```

The field-by-field copy in `resolveSession()` becomes a destructured spread that excludes `agent` and `effectiveAgent` (loaded with `sanitize: false`, must not leak into session):
```typescript
const { agent, effectiveAgent, orgId, ...runtimeConfig } = config
const session: TSession = {
  agentId: agent.id,
  orgId,
  userId: payload.userId,
  projectId: payload.projectId,
  ...runtimeConfig,
}
```

`TAgentRuntimeConfig` stays in backend (references `IAgentRunnerDB`), not domain.

**Files changed:**
- Modify: `repos/backend/src/types/agent.types.ts` — add `TAgentRuntimeConfig`, move `TResolvedAgentConfig` and `TResolveAgentOpts` here from `resolveAgentConfig.ts`
- Modify: `repos/backend/src/types/session.types.ts` — redefine `TSession` as intersection
- Modify: `repos/backend/src/endpoints/ai/onWSConnect.ts` — simplify `resolveSession()` to use spread
- Modify: `repos/backend/src/utils/agent/resolveAgentConfig.ts` — remove type definitions (import from `@TBE/types`)

### 1C. OAI Types Relocation (Issue #12)

**Problem:** OAI types are defined in `repos/backend/src/services/openai/types.ts` (a service file, not a types file). `oaiModels.ts` redefines `TOAIModel` inline instead of importing it. `TOAIModel` and `TOAIModelList` are defined but never imported anywhere.

**Design:**

Move all OAI types to `repos/backend/src/types/oai.types.ts`:
- Request types: `TOAIContentPart`, `TOAIToolCall`, `TOAIMessage`, `TOAIRequest`
- Response types: `TOAIUsage`, `TOAIChoiceMessage`, `TOAIChoice`, `TOAIResponse`, `TOAIChoiceDelta`, `TOAIChunkChoice`, `TOAIChunk`, `TOAIErrorBody`
- Model types: `TOAIModel`, `TOAIModelList`

Update all consumers to import from `@TBE/types`. Replace inline type in `oaiModels.ts` with `TOAIModel[]`.

**Files changed:**
- Create: `repos/backend/src/types/oai.types.ts`
- Delete: `repos/backend/src/services/openai/types.ts`
- Modify: `repos/backend/src/types/index.ts` — add oai.types export
- Modify: `repos/backend/src/services/openai/requestAdapter.ts` — update imports
- Modify: `repos/backend/src/services/openai/responseAdapter.ts` — update imports
- Modify: `repos/backend/src/endpoints/agents/oaiModels.ts` — import `TOAIModel`, remove inline type
- Modify: `repos/backend/src/services/openai/requestAdapter.test.ts` — update imports from new types path
- Modify: `repos/backend/src/services/openai/responseAdapter.test.ts` — update imports from new types path

---

## 2. Critical Fixes

### 2A. Double `resolveAgentConfig` Call (Issue #1)

**Problem:** `run()` calls `resolveAgentConfig()` for pre-validation, then `runHeadless()` calls it again. For K8s sandbox agents, this starts two pods.

**Design:**

Add optional `resolvedConfig?: TResolvedAgentConfig` to `runHeadless()`. When provided, skip internal resolution:

```
runHeadless(req, db, opts & { resolvedConfig? }):
  if opts.resolvedConfig → use it
  else → call resolveAgentConfig()

run(req, res, db, opts):
  config = resolveAgentConfig()   // once
  create thread using config.orgId
  set SSE headers
  runHeadless(req, db, { ...opts, threadId, resolvedConfig: config })

oaiChatCompletions action:
  config = resolveAgentConfig()   // once (replaces separate agent.get call)
  seed thread using config.orgId
  agent.runHeadless(req, db, { ...opts, resolvedConfig: config })
```

This also fixes Issue #2 — the separate `agent.get` call in `oaiChatCompletions` (with its `orgId || ''` fallback) is replaced by `resolveAgentConfig()` which validates agent existence and throws 404.

**Files changed:**
- Modify: `repos/backend/src/services/endpoints/agentEndpoint.ts` — add `resolvedConfig` to `runHeadless`, pass from `run`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.ts` — use `resolveAgentConfig` instead of `agent.get`, pass config to `runHeadless`
- Modify: `repos/backend/src/types/agent.types.ts` — add `resolvedConfig?` to `TAgentExecOpts` or create a new opts type for `runHeadless`
- Modify: `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts` — update mocks: replace `agent.get` mock with `resolveAgentConfig` mock, verify `resolvedConfig` is passed to `runHeadless`

### 2B. Empty orgId in Thread Creation (Issue #2)

**Resolved by 2A.** The separate `agent.get` call with `orgId || ''` fallback is eliminated. `resolveAgentConfig()` validates agent existence and provides `config.orgId` directly.

---

## 3. Error Handling Fixes

### 3A. Message Seeding Error Handling (Issue #3)

**File:** `repos/backend/src/endpoints/agents/oaiChatCompletions.ts:92-98`

Wrap the message creation loop in try-catch. Return OAI-formatted 500 error on failure.

### 3B. Empty Catch on Session Promise (Issue #4)

**File:** `repos/backend/src/endpoints/ai/onWSConnect.ts:220`

Replace `.catch(() => {})` with `.catch((err) => { logger.error('[WS] Session cleanup error', { error: err }) })`.

### 3C. Skills Loading Severity (Issue #5)

**File:** `repos/backend/src/utils/agent/resolveAgentConfig.ts:118-121`

Change `logger.warn` to `logger.error` for skills loading failures. Agent still runs with empty skills (graceful degradation), but severity is communicated correctly.

### 3D. Provider Type Validation (Issue #6)

**Status:** `resolveProviderType` already throws `Exception(400, ...)` for invalid provider brands — its return type is `T`, never `undefined`. No additional guard is needed in `resolveAgentConfig.ts`.

**Cleanup in `oaiModels.ts`:** The current code has a dead `if (!brand)` guard after calling `resolveProviderType` — since the function throws, this branch is unreachable. Replace the dead guard with a try-catch that gracefully skips providers whose type can't be resolved (the loop should continue, not abort):
```typescript
for (const provider of agent.providers || []) {
  try {
    const brand = resolveProviderType(provider as any)
    const providerModels = ModelRegistry.getModels(brand)
    for (const m of providerModels) {
      models.push({ id: m.id, object: `model`, created, owned_by: brand })
    }
  } catch (err) {
    logger.warn(`[OAI Models] Cannot resolve provider type`, { providerId: provider.id, agentId })
  }
}
```

**Files changed:**
- Modify: `repos/backend/src/endpoints/agents/oaiModels.ts` — replace dead `!brand` guard with try-catch
- Modify: `repos/backend/src/endpoints/agents/oaiModels.test.ts` — update "skip providers with unresolvable type" test to mock `resolveProviderType` throwing instead of returning `null`

### 3E. Streaming Error Format (Issue #7)

**File:** `repos/backend/src/services/openai/responseAdapter.ts:86-89`

Keep current format (matches how OpenAI SDKs handle streaming errors). Add a comment documenting the intentional format choice and why it deviates from chunk structure.

### 3F. Array-Format System Messages (Issue #8)

**File:** `repos/backend/src/services/openai/requestAdapter.ts:136-138`

Handle content parts arrays by extracting text, matching `extractPrompt` pattern:
```typescript
typeof m.content === 'string'
  ? m.content
  : Array.isArray(m.content)
    ? m.content.filter(p => p.type === 'text').map(p => p.text).join('\n')
    : ''
```

### 3G. SSE Error Logging (Issue #9)

**File:** `repos/backend/src/services/endpoints/agentEndpoint.ts:173-178`

Log full error object with stack trace and context (`agentId`, `threadId`).

---

## 4. Test Coverage

### 4A. `resolveAgentConfig` Unit Tests (Issue #13)

**Create:** `repos/backend/src/utils/agent/resolveAgentConfig.test.ts`

Test cases:
- Agent not found → 404
- Agent has no providers → 400
- Provider selection with explicit `providerId` override
- Override merging precedence
- Secret resolution (API key, headers, body params)
- Skills loading failure → continues with empty array, logs error
- `resolveProviderType` throws for invalid brand (verify exception propagation)
- K8s sandbox pod startup path
- `onExecuteFunction` callback — function found vs not found
- `envVars` passthrough from overrides

Mock strategy: follow patterns from `runAgent.test.ts` — mock `db.services.*`, `SecretResolver`, `FunctionExecutor`, `sandbox.startPod`, `resolveProviderType`, `ModelRegistry`.

### 4B. `runHeadless` Direct Tests (Issue #14)

**Modify:** `repos/backend/src/endpoints/agents/runAgent.test.ts`

Additional test cases:
- Happy path — resolves config, creates thread, runs agent, returns `{ threadId }`
- Uses pre-resolved config when `resolvedConfig` provided (skips resolution)
- Reuses existing thread when `threadId` provided
- Thread creation failure → throws 500
- `onEvent` callback passed through to `AgentRunner.run`

---

## File Change Summary

| Action | File | Changes |
|--------|------|---------|
| Modify | `repos/domain/src/types/ai.types.ts` | Add `TAgentOverrides`, redefine `TAgentRunOverrides` |
| Modify | `repos/domain/src/types/epd.types.ts` | Redefine endpoint overrides to extend base |
| Create | `repos/backend/src/types/oai.types.ts` | All OAI types relocated here |
| Modify | `repos/backend/src/types/agent.types.ts` | Add `TAgentRuntimeConfig`, `TResolvedAgentConfig`, `TResolveAgentOpts`; update `TAgentExecOpts` |
| Modify | `repos/backend/src/types/session.types.ts` | Redefine `TSession` as intersection |
| Modify | `repos/backend/src/types/index.ts` | Add oai.types export |
| Delete | `repos/backend/src/services/openai/types.ts` | Types moved to types/ |
| Modify | `repos/backend/src/services/endpoints/agentEndpoint.ts` | Add `resolvedConfig` param, fix logging |
| Modify | `repos/backend/src/endpoints/agents/oaiChatCompletions.ts` | Use `resolveAgentConfig`, add seeding error handling |
| Modify | `repos/backend/src/endpoints/agents/oaiModels.ts` | Import `TOAIModel`, replace dead `!brand` guard with try-catch |
| Modify | `repos/backend/src/endpoints/ai/onWSConnect.ts` | Simplify `resolveSession`, fix empty catch |
| Modify | `repos/backend/src/utils/agent/resolveAgentConfig.ts` | Move types out, fix skills logging severity |
| Modify | `repos/backend/src/services/openai/requestAdapter.ts` | Update imports, fix system message extraction |
| Modify | `repos/backend/src/services/openai/responseAdapter.ts` | Update imports, document error format |
| Create | `repos/backend/src/utils/agent/resolveAgentConfig.test.ts` | New unit tests |
| Modify | `repos/backend/src/endpoints/agents/runAgent.test.ts` | Add `runHeadless` direct tests |
| Modify | `repos/backend/src/endpoints/agents/oaiChatCompletions.test.ts` | Update for resolvedConfig changes |
| Modify | `repos/backend/src/endpoints/agents/oaiModels.test.ts` | Update mock: throw instead of returning null, update imports |
| Modify | `repos/backend/src/services/openai/requestAdapter.test.ts` | Add array system message test |
| Modify | `repos/backend/src/services/openai/responseAdapter.test.ts` | Update imports |
