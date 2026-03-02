# Pi-Mono Deep Dive: Full Capability Analysis & ThreadedStack Integration Plan

## Context

ThreadedStack currently uses only 2 of pi-mono's 7 packages (`pi-ai` and `pi-agent-core`), and even those are used at a fraction of their capability. The agent runtime creates a basic `Agent` per request with no context management, no thinking modes, no cost tracking, no vision support, and no steering/follow-up. Meanwhile, pi-mono offers a rich feature set including context overflow detection, token cost tracking, reasoning modes, image input, prompt caching, session trees, web UI components, file extraction, and more.

This plan catalogs every pi-mono capability, maps it to ThreadedStack's architecture, and provides a fully detailed 7-phase integration strategy. The goal: take full advantage of pi-mono with nothing off the table.

**Decisions**:
- Scope: All phases (0–6) fully detailed and in-scope
- pi-web-ui: Embed web components directly in React via refs/custom elements
- Versioning: Upgrade pi-mono from v0.52.12 → latest as part of Phase 0

**HARD REQUIREMENTS (non-negotiable across ALL phases)**:

1. **All tool execution MUST use the existing sandbox stack**: `InMemoryFs` (virtual filesystem) + `Bash` (just-bash shell) + `IsolateRunner` (V8 isolate via isolated-vm). This applies to ALL new tools, skills, artifact execution, function handlers, and any code evaluation. No new sandbox or execution system may be created. The existing `createSandboxProvider()` factory → `LocalSandboxProvider` → `LocalSandbox(bash, fs, isolateRunner)` pipeline is the **only** execution path.

2. **All requests MUST go through the proxy → backend → agent pipeline**: Client → Proxy (JWT/API key auth) → Backend (AgentEndpoint / onWSConnect) → AgentRunner → Agent. Secrets are resolved server-side by `SecretResolver` and never exposed to clients. LLM API keys flow: `SecretResolver.resolveApiKey()` → `llmConfig` → `streamFn` → provider. The REPL uses `streamProxy()` to route through the backend — it never calls LLM providers directly.

3. **Custom functions ARE dynamic tools — no new tables, columns, or builders**: The existing `FunctionModel` / `functions` table / `FunctionExecutor` / `buildCustomFunctionTools()` pipeline is the tool extension system. It already provides: tool definition (name, description, inputSchema), code handler (content), sandboxed execution (`FunctionExecutor.execute()` → `ISandbox.evaluate()`), and agent association (`agentFunctions` junction). FaaS endpoints provide HTTP-triggered function execution. Nothing needs to be extended or added.

---

## Part 1: Pi-Mono Capability Inventory

### Package 1: `@mariozechner/pi-ai` — Unified LLM API

| Capability | Description | Used? |
|-----------|-------------|:---:|
| `getModel(provider, modelId)` | Static model registry lookup | Yes |
| `getProviders()` | List all known providers | **No** |
| `getModels(provider)` | List all models for a provider | **No** |
| `stream()` / `complete()` | Low-level provider streaming | **No** |
| `streamSimple()` / `completeSimple()` | High-level streaming with reasoning | **No** |
| `calculateCost(model, usage)` | Token cost calculation | **No** |
| `isContextOverflow(message, contextWindow?)` | Context window overflow detection | **No** |
| `validateToolCall()` / `validateToolArguments()` | Tool argument validation | **No** |
| `StringEnum(values, opts)` | Cross-provider enum schemas | **No** |
| `supportsXhigh(model)` | Check xhigh thinking support | **No** |
| `modelsAreEqual(a, b)` | Compare models | **No** |
| `getEnvApiKey(provider)` | Env-based API key resolution | **No** |
| `createAssistantMessageEventStream()` | Event stream factory | **No** |
| `Type` (TypeBox) | Schema builder for tools | Yes |
| `ImageContent` type | Vision/image input | **No** |
| `ThinkingContent` type | Reasoning blocks | **No** (skipped) |
| `Usage` type | Token tracking | **No** (hardcoded 0) |
| `StreamOptions.cacheRetention` | Prompt caching | **No** |
| `StreamOptions.sessionId` | Session-based caching | **No** |
| `StreamOptions.temperature` | Temperature control | **No** (not passed) |
| `StreamOptions.metadata` | Provider metadata | **No** |
| `StreamOptions.transport` | SSE/WS/auto | **No** |
| `StreamOptions.maxRetryDelayMs` | Retry delay cap | **No** |
| `OpenAICompletionsCompat` | Custom provider compat | **No** |
| Message types (User/Assistant/ToolResult) | LLM messages | Yes |
| 23+ providers | Full provider registry | Partially |

### Package 2: `@mariozechner/pi-agent-core` — Stateful Agent Runtime

| Capability | Description | Used? |
|-----------|-------------|:---:|
| `Agent` class | Core agent | Yes (basic) |
| `agent.prompt(text, images?)` | Prompt with images | Partial (text only) |
| `agent.subscribe(fn)` | Event subscription | Yes |
| `agent.waitForIdle()` | Wait for completion | Yes |
| `agent.abort()` | Cancel | Yes |
| `agent.steer(message)` | Interrupt mid-execution | **No** |
| `agent.followUp(message)` | Queue post-turn work | **No** |
| `agent.continue()` | Resume/retry | **No** |
| `agent.setSystemPrompt()` | Runtime prompt change | **No** |
| `agent.setModel()` | Runtime model switch | **No** |
| `agent.setTools()` | Runtime tool swap | **No** |
| `agent.setThinkingLevel()` | Reasoning level | **No** |
| `agent.replaceMessages()` | Replace history | **No** |
| `agent.appendMessage()` | Add message | **No** |
| `agent.reset()` | Full reset | **No** |
| `agent.sessionId` | Prompt caching | **No** |
| `agent.thinkingBudgets` | Thinking token limits | **No** |
| `state.pendingToolCalls` | Active tool tracking | **No** |
| `state.isStreaming` | Streaming status | **No** |
| `transformContext` hook | Context pruning/injection | **No** |
| `convertToLlm` handler | Custom message conversion | **No** (uses default) |
| Steering/follow-up modes | "all" / "one-at-a-time" | **No** |
| `streamFn` | Custom stream function | **No** |
| `ThinkingLevel` | off→xhigh | **No** |
| Custom message types | Declaration merging | **No** |
| `agentLoop()` / `agentLoopContinue()` | Low-level loop | **No** |
| `streamProxy()` | Built-in proxy streaming | **No** |

### Package 3: `@mariozechner/pi-web-ui` — Web Chat Components

| Capability | Description | Used? |
|-----------|-------------|:---:|
| `ChatPanel` | Drop-in chat UI | **No** |
| `AgentInterface` | Customizable interface | **No** |
| `ArtifactsPanel` | Interactive HTML/SVG/Markdown | **No** |
| File attachments | PDF/DOCX/XLSX/images + extraction | **No** |
| JavaScript REPL | Sandboxed browser execution | **No** |
| IndexedDB storage | Client-side persistence | **No** |

### Packages 4-7: pi-coding-agent, pi-tui, pi-mom, pi-pods

Key **patterns** to adopt (not direct dependencies):
- **Context compaction** (pi-coding-agent) — auto-summarize near limits
- **Session trees** (pi-coding-agent) — non-destructive branching
- **Skills system** (pi-coding-agent) — SKILL.md agent capabilities
- **Event scheduling** (pi-mom) — cron-triggered agent runs
- **Differential TUI rendering** (pi-tui) — for REPL enhancement

---

## Part 2: Current Integration Gaps

### Critical (broken/missing)

| # | Gap | Impact |
|---|-----|--------|
| G1 | Token usage hardcoded to zeros (`websocket.ts` TurnEnd) | No cost visibility |
| G2 | No context window management (loads 100 msgs, sends all) | Long conversations crash |
| G3 | No context overflow detection | Opaque provider errors |
| G4 | Thinking blocks discarded (`messageConverter.ts:116`) | Chain-of-thought lost |

### High-value

| # | Gap | Impact |
|---|-----|--------|
| G5 | No thinking/reasoning modes | Can't control reasoning depth |
| G6 | No image/vision support | Can't send images to agents |
| G7 | No prompt caching (sessionId/cacheRetention not passed) | Full cost every conversation |
| G8 | No cost tracking (calculateCost never called) | No billing/analytics |
| G9 | No agent steering (abort-only) | Can't redirect running agents |
| G10 | No dynamic model enumeration | Manual model lists |

### Enhancement

| # | Gap | Impact |
|---|-----|--------|
| G11 | No temperature/maxTokens passthrough to Agent | Config not reaching LLM |
| G12 | No retry/resume on errors | Entire run fails on transient errors |
| G13 | New Agent per request, no persistence | No session continuity or caching |
| G14 | No context compaction | Messages just accumulate |
| G15 | No custom message types | Can't do artifacts, notifications |
| G16 | No file/document handling | No upload/extraction in chat |
| G17 | No artifact rendering | No interactive HTML/SVG output |

---

## Part 3: Implementation Plan

### Phase 0: Upgrade Pi-Mono (Prerequisite)

**Upgrade `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` from v0.52.12 → v0.55.3**

**Files to change**:
- `repos/agent/package.json` — Update both dependency versions
- `repos/backend/package.json` — Update `@mariozechner/pi-ai` version
- Root `pnpm-lock.yaml` — Will auto-update via `pnpm install`

**Verification**:
1. `pnpm install` from root
2. `cd repos/agent && pnpm test` — All 179 tests must pass
3. `cd repos/agent && pnpm types` — Type check clean
4. `cd repos/backend && pnpm test` — Backend tests pass
5. `cd repos/backend && pnpm types` — Type check clean
6. Review pi-mono changelog for breaking changes between v0.52.12 and v0.55.3
7. Check if any new exports or type changes affect existing code

**Risk**: Breaking changes in message types, Agent constructor, or event payloads. Mitigate by reading changelog and running full test suite.

**Existing infrastructure to leverage**:
- Agent test suite (`repos/agent/src/__tests__/`) — 179 tests that validate all pi-mono integration points. These are the primary regression safety net
- Backend test suite — validates endpoint layer, WS handling, and service layer that depend on pi-ai types
- `getModel()` usage in `repos/agent/src/runner/runner.ts` and `repos/backend/src/services/providers/dynamicModels.ts` — check for breaking API changes here first
- `Agent` constructor usage in `repos/agent/src/runner/runner.ts` — the primary integration point

---

### Phase 1: Wire Existing Data (Fixes G1, G7, G8, G10, G11)

#### 1.1 Token Usage & Cost Tracking (G1, G8)

**Problem**: `AssistantMessage.usage` contains real token data but it's never extracted. `websocket.ts` sends `{ input: 0, output: 0 }`.

**Pi-mono APIs**: `AssistantMessage.usage: Usage`, `calculateCost(model, usage)`

**Files**:
- `repos/domain/src/types/ai.types.ts`
  - Add `usage?: TTokenUsage` to `TStreamEvent` done variant
  - Define `TTokenUsage = { input: number; output: number; cacheRead: number; cacheWrite: number; cost: { input: number; output: number; total: number } }`
- `repos/agent/src/adapters/eventBridge.ts`
  - Extract `usage` from `message_update` done event: `ame.message.usage`
  - Include `usage` in the returned `TStreamEvent.done`
  - Import and call `calculateCost(model, usage)` to compute costs
  - `mapAgentEvent()` needs to receive the `Model` (add parameter or closure)
- `repos/agent/src/runner/runner.ts`
  - Pass `model` reference to event bridge (via closure in subscribe callback)
- `repos/backend/src/services/websocket/websocket.ts`
  - Forward real `usage` from `TStreamEvent.done` in `EWSEventType.TurnEnd`
- `repos/domain/src/types/ws.types.ts`
  - Update `TurnEnd` payload to include full `TTokenUsage`

#### 1.2 Prompt Caching (G7)

**Problem**: No `sessionId` or `cacheRetention` passed. Repeat conversations pay full token costs.

**Pi-mono APIs**: `AgentOptions.sessionId`, `StreamOptions.cacheRetention`

**Files**:
- `repos/agent/src/runner/runner.ts`
  - Pass `sessionId: threadId` to Agent constructor (thread ID = natural session boundary)
  - Note: For cacheRetention, need to pass via custom `streamFn` wrapper or check if Agent constructor accepts it (may need to wrap `streamSimple`)
- `repos/domain/src/types/agent.types.ts`
  - Add `cacheRetention?: 'none' | 'short' | 'long'` to `TAgentEnvironment`
- `repos/agent/src/types/runner.types.ts`
  - No change needed — threadId already in opts

#### 1.3 Temperature & StreamOptions Passthrough (G11)

**Problem**: `llmConfig.temperature` and `llmConfig.maxTokens` exist but aren't passed to the Agent.

**Pi-mono APIs**: Agent doesn't directly accept StreamOptions, but `streamFn` wrapper can inject them.

**CRITICAL — Proxy architecture preservation**: The `streamFn` wrapper runs **server-side inside the backend**. All LLM requests originate from the backend, never from the client. The existing architecture is: Client → Proxy (auth) → Backend (AgentEndpoint.execute or onWSConnect) → AgentRunner.run() → pi-mono Agent → streamFn → LLM provider. The `streamFn` receives already-resolved secrets (API keys, headers) from `SecretResolver` — secrets never leave the backend. This architecture **MUST be preserved** in all phases.

**Files**:
- `repos/agent/src/runner/runner.ts`
  - Create a `streamFn` wrapper around `streamSimple` that injects `temperature`, `maxTokens`, `cacheRetention`, `metadata` from `llmConfig`:
    ```typescript
    import { streamSimple } from '@mariozechner/pi-ai'
    const streamFn = (model, context, options) =>
      streamSimple(model, context, {
        ...options,
        temperature: llmConfig.temperature,
        maxTokens: llmConfig.maxTokens,
        cacheRetention: opts.environment?.cacheRetention,
        headers: llmConfig.headers,
        metadata: llmConfig.provider === 'anthropic' ? { user_id: opts.userId } : undefined,
      })
    ```
  - Pass `streamFn` to Agent constructor
  - **Note**: `llmConfig` already contains resolved API keys and headers from `AgentEndpoint.execute()` → `SecretResolver`. The streamFn must use these resolved values, never re-resolve or expose them

#### 1.4 Pi-Mono as Sole Source of Truth for Models & Providers (G10)

**Problem**: ThreadedStack has hardcoded model lists in `ProviderTemplates` (7 providers, ~20 models), 5 provider-specific fetch functions in `DynamicModels`, and static model arrays in the admin UI. These are incomplete, stale, and lack cost/capability data. Pi-mono maintains a comprehensive, auto-updated registry of 20+ providers and 200+ models with full metadata.

**Pi-mono APIs**: `getProviders()`, `getModels(provider)`, `getModel(provider, modelId)`, `supportsXhigh(model)`, `calculateCost(model, usage)`, `Model` type (id, name, contextWindow, maxTokens, cost, reasoning, input types)

**Approach**: Pi-mono becomes the **sole authority** for available models and providers. Remove all hardcoded model arrays. Remove the `DynamicModels` class (5 provider-specific fetch functions). The `fetchModels` endpoint becomes a thin wrapper around `getModels(provider)`. All existing providers (openai, anthropic, google, zai, openrouter, ollama, custom) continue to be supported — pi-mono already knows them all plus 13+ more.

**What gets removed**:
- `ProviderTemplates[brand].models` arrays — hardcoded model lists replaced by `getModels(provider)`
- `ProviderTemplates[brand].defaultModel` — replaced by first model from `getModels(provider)` or user preference
- `DynamicModels` class at `backend/src/services/providers/dynamicModels.ts` — the 5 provider-specific fetch functions (openAI, google, openRouter, ollama, zai) are fully replaced by `getModels(provider)`
- `fetchModels.ts` switch/case branching — replaced by a single `getModels(brand)` call

**What stays** (provider config templates, NOT model lists):
- `ProviderTemplates` structure for **non-model config only**: `baseUrl`, `defaultSecretName`, `apiKeyPlaceholder`, `apiKeyPattern`, `name`. These are UI/config templates, not model data. Remove the `models[]` and `defaultModel` fields
- `providers` DB table — stores user-created provider instances (orgId, brand, secretId, options, headers). This is provider **configuration**, not model data. Unchanged
- `ELLMProviderBrand` enum — expand to include all pi-mono `KnownProvider` values (20+), keeping existing 7 + adding new ones
- `Provider` model class — unchanged, stores org-specific provider config

**Files — Domain types**:
- `repos/domain/src/constants/providers.ts`
  - **Remove** `models: TProviderModel[]` and `defaultModel: string` from each `ProviderTemplate`
  - **Keep** `baseUrl`, `defaultSecretName`, `apiKeyPlaceholder`, `apiKeyPattern`, `name`
  - These become **provider config templates** (how to configure auth), not model catalogs
  - Add new provider templates for pi-mono providers not yet in ThreadedStack (groq, cerebras, mistral, xai, bedrock, etc.) — at minimum add the config template so users can create provider instances
- `repos/domain/src/types/ai.types.ts`
  - Expand `ELLMProviderBrand` enum to include all pi-mono `KnownProvider` values
  - Map ThreadedStack brand names to pi-mono provider names where they differ
  - Add `TModelInfo` type that wraps pi-mono's `Model` with ThreadedStack-specific fields:
    ```typescript
    TModelInfo = {
      id: string
      name: string
      provider: TLLMProviderBrand
      contextWindow: number
      maxTokens: number
      reasoning: boolean
      cost: { input: number; output: number; cacheRead: number; cacheWrite: number }
      inputTypes: string[]    // 'text', 'image', etc.
    }
    ```
- `repos/domain/src/types/quickstart.types.ts`
  - Remove `TProviderModel` type (no longer needed — models come from pi-mono)
  - Remove `models` field from `TProviderTemplate`

**Files — Backend**:
- `repos/backend/src/services/providers/dynamicModels.ts`
  - **Replace entirely** with a pi-mono wrapper:
    ```typescript
    import { getProviders, getModels, getModel } from '@mariozechner/pi-ai'

    export class ModelRegistry {
      static getProviders(): string[] {
        return getProviders()
      }

      static getModels(provider: string): TModelInfo[] {
        return getModels(provider).map(m => ({
          id: m.id,
          name: m.name,
          provider: provider as TLLMProviderBrand,
          contextWindow: m.contextWindow,
          maxTokens: m.maxTokens,
          reasoning: m.reasoning,
          cost: m.cost,
          inputTypes: m.input,
        }))
      }

      static getModel(provider: string, modelId: string): TModelInfo | undefined {
        try { return this.mapModel(getModel(provider, modelId)) }
        catch { return undefined }
      }
    }
    ```
  - For **Ollama** (local models not in pi-mono registry): still fetch from `{baseUrl}/api/tags` as a supplemental source, since Ollama models are user-installed and can't be known statically. Merge with any pi-mono Ollama models
  - For **custom** provider brand: no static models (user provides model ID manually). This is unchanged
- `repos/backend/src/endpoints/providers/fetchModels.ts`
  - **Simplify**: Replace 5-case switch with single `ModelRegistry.getModels(brand)` call
  - Special case only for Ollama (supplemental local fetch) and custom (empty list)
  - Return enriched model data: `{ id, name, contextWindow, maxTokens, reasoning, cost, inputTypes }`
  - No more fallback to static arrays — pi-mono IS the source
- `repos/backend/src/endpoints/providers/orgQuickstart.ts`
  - Replace `ProviderTemplates[brand].defaultModel` lookup with `ModelRegistry.getModels(brand)[0]` or user-provided model
  - Replace `template.models.find(m => m.id === modelId)` with `ModelRegistry.getModel(brand, modelId)`

**Files — Admin UI**:
- `repos/admin/src/hooks/components/useQuickStart.ts`
  - Replace static `ProviderTemplates[brand].models` with API call to `/_/providers/:brand/models`
  - Show loading state while models fetch
  - Cache model list per provider brand (no refetch on each render)
- `repos/admin/src/components/Providers/` — Model selector components
  - Fetch models dynamically from backend endpoint (which now uses pi-mono)
  - Show model capabilities: reasoning badge, context window size, cost tier
  - Search/filter models by name or capability
- `repos/admin/src/components/Agents/AgentDrawer.tsx` (or model selector within)
  - Model dropdown populated from pi-mono via backend endpoint
  - Show model metadata (context window, cost, reasoning support) inline

**Existing infrastructure to leverage**:
- `providers` DB table at `database/src/schemas/providers.ts` → stores org provider **config** (secretId, baseUrl, headers). This is NOT replaced — it stores user credentials, not model catalogs
- `SecretResolver` → provider API keys stay in secrets table, resolved server-side. Pi-mono model lookup doesn't need API keys (it's a static registry)
- `TAgentEnvironment` JSONB → model preferences can be stored here per agent
- `Agent.getEffectiveConfig(projectId)` → model selection inherits project overrides

**Verification**:
- `GET /_/providers/anthropic/models` returns pi-mono's full Anthropic model list with cost data
- `GET /_/providers/openai/models` returns pi-mono's full OpenAI model list
- All 7 existing provider brands return models (no regressions)
- New providers (groq, cerebras, mistral, etc.) also return models
- Quickstart wizard shows dynamic model list with capabilities
- `calculateCost(model, usage)` returns accurate cost for sent messages (ties into Phase 1.1)

**Verification for Phase 1**:
- `pnpm test` across agent, backend, domain
- `pnpm types` across all repos
- Send a chat message via WS → verify TurnEnd event has non-zero `usage` and `cost`
- Verify prompt caching headers appear in provider requests (check Anthropic dashboard or logs)
- Verify temperature is applied (test with temp=0 for deterministic output)
- `GET /_/providers/anthropic/models` → returns all Anthropic models from pi-mono with cost/contextWindow/reasoning data
- `GET /_/providers/openai/models` → returns all OpenAI models from pi-mono
- All 7 existing provider brands return models (no regressions vs current system)
- Quickstart wizard populates model dropdown dynamically from backend API
- No hardcoded model arrays remain in `ProviderTemplates`

---

### Phase 2: Safety & Reliability (Fixes G2, G3, G12)

#### 2.1 Context Window Management (G2)

**Problem**: `runner.ts` loads 100 messages and sends all. Long conversations WILL exceed context limits.

**Pi-mono APIs**: `AgentOptions.transformContext`

**Files**:
- `repos/agent/src/utils/contextManager.ts` — **New file**:
  - `createContextManager(model: Model)` factory
  - Strategy: estimate tokens per message, keep messages within 80% of `model.contextWindow`
  - Keep first 2 messages (system context) + most recent N messages that fit
  - Return pruned `AgentMessage[]`
- `repos/agent/src/runner/runner.ts`
  - Pass `transformContext` to Agent constructor:
    ```typescript
    new Agent({
      transformContext: async (messages) => {
        return pruneToFitContext(messages, model.contextWindow)
      },
      ...
    })
    ```
- `repos/domain/src/types/agent.types.ts`
  - Add `contextBudgetPercent?: number` to `TAgentEnvironment` (default 80)

#### 2.2 Context Overflow Detection (G3)

**Problem**: Overflow crashes with opaque provider errors.

**Pi-mono APIs**: `isContextOverflow(message, contextWindow)`

**Files**:
- `repos/agent/src/runner/runner.ts`
  - In the event subscriber, on `message_update` with `done` type where `reason === 'error'`:
    ```typescript
    import { isContextOverflow } from '@mariozechner/pi-ai'
    if (event.type === 'message_update' && ame.type === 'error') {
      const msg = ame.error // AssistantMessage with error
      if (isContextOverflow(msg, model.contextWindow)) {
        onEvent({ type: 'error', error: 'Context window exceeded. Conversation is too long.' })
        // Could trigger context compaction + retry via agent.continue() in Phase 4
      }
    }
    ```
- `repos/agent/src/adapters/eventBridge.ts`
  - Add overflow-specific error type or flag to error events

#### 2.3 Retry/Resume on Transient Errors (G12)

**Problem**: Any error fails the entire run.

**Pi-mono APIs**: `agent.continue()`

**Files**:
- `repos/agent/src/runner/runner.ts`
  - After `agent.prompt()` + `agent.waitForIdle()`, check `agent.state.error`
  - If transient (rate limit, network), retry with exponential backoff:
    ```typescript
    let retries = 0
    const maxRetries = opts.maxRetries ?? 2
    while (retries < maxRetries && agent.state.error && isTransientError(agent.state.error)) {
      retries++
      await delay(1000 * retries)
      await agent.continue()
      await agent.waitForIdle()
    }
    ```
- `repos/agent/src/utils/errorClassifier.ts` — **New file**: `isTransientError(error: string): boolean`
- `repos/agent/src/types/runner.types.ts` — Add `maxRetries?: number` to `TAgentRunOpts`

**Existing infrastructure to leverage**:
- Message history loading at `runner.ts:34-39` uses `db.listMessages({ where: { threadId }, limit: 100, offset: 0 })` → contextManager must accept the same `TAIMessage[]` format this returns
- `model.contextWindow` from pi-ai's `Model` type → already available via `getModel()`, use for budget calculation
- `contextBudgetPercent` goes in `TAgentEnvironment` (JSONB) → inherits project overrides automatically via `Agent.getEffectiveConfig(projectId)`
- AbortSignal wiring at `runner.ts:97-100` → retry loop must check `signal.aborted` between retries
- Provider priority via `agentProviders` junction table (agentId, providerId, priority) → on transient failure, consider fallback to next-priority provider before retrying same one. Query via `agent.agentProviders` relation

**Verification for Phase 2**:
- Unit tests for context pruning logic
- Integration test: send 100+ messages to exceed context → verify graceful handling
- Test retry behavior: mock a transient failure → verify agent resumes

---

### Phase 3: New Agent Capabilities (Fixes G4, G5, G6, G9)

#### 3.1 Thinking/Reasoning Mode Support (G4, G5)

**Problem**: No reasoning control. Thinking blocks discarded.

**Pi-mono APIs**: `ThinkingLevel`, `ThinkingBudgets`, `agent.setThinkingLevel()`, `ThinkingContent`

**Files**:
- `repos/domain/src/types/agent.types.ts`
  - Add to `TAgentEnvironment`:
    ```typescript
    thinkingLevel?: 'off' | 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'
    thinkingBudgets?: { minimal?: number; low?: number; medium?: number; high?: number }
    ```
- `repos/domain/src/types/ai.types.ts`
  - Add `EContentType.thinking = 'thinking'`
  - Add `TThinkingContent = { type: 'thinking'; thinking: string }` to `TMessageContent` union
  - Add `EStreamEventType.thinking = 'thinking'` and thinking event to `TStreamEvent`
- `repos/agent/src/runner/runner.ts`
  - Pass `thinkingLevel` from environment to Agent `initialState.thinkingLevel` (if not 'off')
  - Pass `thinkingBudgets` to Agent options
- `repos/agent/src/adapters/eventBridge.ts`
  - Map `thinking_start`, `thinking_delta`, `thinking_end` from `message_update` events:
    ```typescript
    case 'thinking_delta':
      return { type: EStreamEventType.thinking, thinking: ame.delta }
    ```
- `repos/agent/src/adapters/messageConverter.ts`
  - **Remove** line 116 skip comment. Persist `ThinkingContent` blocks:
    ```typescript
    else if (block.type === 'thinking') {
      content.push({ type: EContentType.thinking, thinking: block.thinking })
    }
    ```
  - In `convertToLlmMessages`, restore thinking blocks from persisted messages
- `repos/domain/src/types/ws.types.ts`
  - Add `EWSEventType.ThinkingDelta` with `delta: string`
- `repos/backend/src/services/websocket/websocket.ts`
  - Bridge thinking events to WS
- Database — `TMessageContent` already stored as JSONB, so `thinking` type will persist naturally

#### 3.2 Image/Vision Support (G6)

**Problem**: Users can't send images to vision-capable models.

**Pi-mono APIs**: `ImageContent`, `UserMessage.content: (TextContent | ImageContent)[]`, `agent.prompt(text, images)`

**Files**:
- `repos/domain/src/types/ai.types.ts`
  - Add `TImageContent = { type: 'image'; data: string; mimeType: string }` to `TMessageContent` union
  - Add `EContentType.image = 'image'`
- `repos/agent/src/types/runner.types.ts`
  - Add `images?: Array<{ data: string; mimeType: string }>` to `TAgentRunOpts`
- `repos/agent/src/runner/runner.ts`
  - If `opts.images?.length`, include in user message content and pass to `agent.prompt()`:
    ```typescript
    const imageContents = opts.images?.map(img => ({ type: 'image' as const, ...img }))
    await agent.prompt(prompt, imageContents)
    ```
  - Save image references in user message to DB
- `repos/agent/src/adapters/messageConverter.ts`
  - Convert `TImageContent` → pi-ai `ImageContent` in `convertToLlmMessages`
  - Handle `ImageContent` in `ToolResultMessage` (tool results can include images)
- `repos/domain/src/types/ws.types.ts`
  - Add `images` field to WS prompt message type
- `repos/backend/src/services/websocket/websocket.ts`
  - Extract images from WS prompt message, pass to AgentRunner
- `repos/backend/src/endpoints/agents/runAgent.ts`
  - Accept images in SSE request body

#### 3.3 Agent Steering & Follow-Up (G9)

**Problem**: Users can only abort. Can't redirect a running agent.

**Pi-mono APIs**: `agent.steer()`, `agent.followUp()`, `clearSteeringQueue()`, `clearFollowUpQueue()`

**Files**:
- `repos/domain/src/types/ws.types.ts`
  - Add to `TWSClientMsg`:
    ```typescript
    | { type: 'steer'; message: string }
    | { type: 'followUp'; message: string }
    ```
- `repos/agent/src/types/runner.types.ts`
  - Change `AgentRunner.run()` return type from `Promise<void>` to `Promise<AgentHandle>`:
    ```typescript
    type AgentHandle = {
      steer: (message: string) => void
      followUp: (message: string) => void
      abort: () => void
      waitForIdle: () => Promise<void>
    }
    ```
- `repos/agent/src/runner/runner.ts`
  - Return `AgentHandle` that wraps the internal Agent instance:
    ```typescript
    return {
      steer: (msg) => agent.steer({ role: 'user', content: msg, timestamp: Date.now() }),
      followUp: (msg) => agent.followUp({ role: 'user', content: msg, timestamp: Date.now() }),
      abort: () => agent.abort(),
      waitForIdle: () => agent.waitForIdle(),
    }
    ```
  - Move `waitForIdle` to be called by the WS handler, not inside `run()`
- `repos/backend/src/services/websocket/websocket.ts`
  - Store `AgentHandle` from `AgentRunner.run()`:
    ```typescript
    const handle = await AgentRunner.run(opts)
    // On WS 'steer' message:
    handle.steer(msg.message)
    ```
- `repos/backend/src/endpoints/ai/onWSConnect.ts`
  - Handle `steer` and `followUp` WS message types

**Existing infrastructure to leverage**:
- `TAgentEnvironment` is stored as JSONB → `thinkingLevel` and `thinkingBudgets` fields persist automatically via existing schema. Inherits project overrides via `Agent.getEffectiveConfig(projectId)` without extra code
- `useAgentChat.processWSEvent` in `admin/src/hooks/chat/useAgentChat.ts` already has a switch on event types (TextDelta, ToolExec*, etc.) → **extend** the existing switch with `ThinkingDelta` case, don't restructure
- `MessageBubble` component already shows "Thinking..." when streaming with no text → **extend** to show actual thinking content instead of placeholder
- `TWSClientMsg.FileUpload` already exists in `domain/src/types/ws.types.ts` → leverage or extend for image upload instead of adding a new event type
- Assets table at `database/src/schemas/assets.ts` with exclusive arc (org/project/user/thread/message) → use for image/file storage, link to thread+message
- `AgentWSService.send()` at `admin/src/services/agentWSService.ts` already handles WS message sending → **extend** with `steer()` and `followUp()` methods, don't create a new WS channel
- REPL `Executor.sendMessage()` at `repl/src/services/executor.ts` manages WS → **extend** with steer/followUp message types
- `convertAssistantToContent()` at `messageConverter.ts:101-119` is where ThinkingContent blocks are currently skipped (line 116) → remove the skip and add thinking persistence here
- Message content stored as JSONB → new `thinking` and `image` content types persist automatically, no schema migration needed
- **Sandbox HARD REQUIREMENT**: All tool execution during agent runs (including during steering/follow-up) continues to use the existing `LocalSandbox` (InMemoryFs + Bash + IsolateRunner). Steering redirects the agent's LLM loop but does NOT change the tool execution infrastructure. Tools called after a steer execute in the same sandbox instance as tools called before the steer

**Verification for Phase 3**:
- Unit tests for thinking event mapping, image content conversion
- Integration: Send prompt with `thinkingLevel: 'high'` → verify thinking events stream
- Integration: Send image via WS → verify vision model processes it
- Integration: During tool execution, send `steer` message → verify agent redirects

---

### Phase 4: Architecture Improvements (Fixes G13, G14, G15)

#### 4.1 Persistent Agent Sessions (G13)

**Problem**: New `Agent` created per prompt. No state continuity within a WS session.

**Pi-mono APIs**: `agent.setModel()`, `agent.setTools()`, `agent.setSystemPrompt()`, `agent.replaceMessages()`

**CRITICAL — Proxy architecture preservation**: Persistent Agent sessions live **server-side in the backend only**. The Agent instance is created and held in memory within the backend process. Clients connect via WebSocket through the proxy (Client → Proxy auth → Backend WS → AgentRunner instance). The client never directly accesses the Agent. All secrets remain server-side. Session tokens (created via `POST /_/ai/sessions`) grant scoped access; the backend validates tokens and routes to the correct AgentRunner. This architecture **MUST be preserved** — persistence is a backend concern, not a client concern.

**Files**:
- `repos/agent/src/runner/runner.ts`
  - Refactor from static `AgentRunner.run()` to instance with lifecycle:
    ```typescript
    class AgentRunner {
      private agent: Agent | null = null

      async init(opts: TAgentInitOpts): Promise<void> {
        // Create Agent once with full config
        this.agent = new Agent({...})
      }

      async runTurn(prompt: string, images?: ImageContent[]): Promise<AgentHandle> {
        // Reuse existing Agent, just prompt
        await this.agent.prompt(prompt, images)
        return handle
      }

      async updateConfig(config: Partial<TAgentConfig>): void {
        // Runtime mutations
        if (config.model) this.agent.setModel(config.model)
        if (config.tools) this.agent.setTools(config.tools)
        if (config.systemPrompt) this.agent.setSystemPrompt(config.systemPrompt)
      }

      async destroy(): Promise<void> {
        // Cleanup sandbox, unsubscribe
      }
    }
    ```
- `repos/backend/src/services/websocket/websocket.ts`
  - Create `AgentRunner` instance on WS connect, destroy on disconnect
  - Call `runTurn()` for each prompt instead of `AgentRunner.run()`
- `repos/domain/src/types/ws.types.ts`
  - Add `updateConfig` WS message type for runtime changes

#### 4.2 Context Compaction (G14)

**Problem**: Messages accumulate with no summarization.

**Pi-mono APIs**: `transformContext`, `isContextOverflow()`, `agent.continue()`

**Files**:
- `repos/agent/src/utils/contextManager.ts` — Enhance from Phase 2:
  - Add compaction mode: when near limit, use secondary LLM call to summarize oldest messages
  - Compaction summary stored as a system-level message at start of context
  - Configurable: `{ strategy: 'prune' | 'compact', compactionModel?: string }`
- `repos/agent/src/runner/runner.ts`
  - In `transformContext`, check token budget:
    - If messages fit → return as-is
    - If messages exceed 80% → prune to fit (Phase 2 strategy)
    - If compaction enabled → summarize old messages + keep recent
- `repos/domain/src/types/agent.types.ts`
  - Add `contextCompaction?: { enabled: boolean; strategy: 'prune' | 'compact'; compactionModel?: string }` to `TAgentEnvironment`

#### 4.3 Custom Message Types (G15)

**Problem**: No artifact, notification, or system event messages.

**Pi-mono APIs**: `CustomAgentMessages` declaration merging, `convertToLlm` handler

**Files**:
- `repos/agent/src/types/customMessages.ts` — **New file**:
  ```typescript
  declare module "@mariozechner/pi-agent-core" {
    interface CustomAgentMessages {
      artifact: {
        role: "artifact"
        content: string
        mimeType: string
        title: string
        timestamp: number
      }
      notification: {
        role: "notification"
        text: string
        level: "info" | "warn" | "error"
        timestamp: number
      }
      systemEvent: {
        role: "systemEvent"
        event: string
        data: Record<string, unknown>
        timestamp: number
      }
    }
  }
  ```
- `repos/agent/src/runner/runner.ts`
  - Pass custom `convertToLlm` to Agent constructor that filters out non-LLM messages:
    ```typescript
    convertToLlm: (messages) => {
      return messages.filter(m =>
        m.role === 'user' || m.role === 'assistant' || m.role === 'toolResult'
      ) as Message[]
    }
    ```
- `repos/domain/src/types/ai.types.ts`
  - Add artifact and notification content types to `TMessageContent` union
- `repos/agent/src/adapters/messageConverter.ts`
  - Handle custom message types in bidirectional conversion

**Existing infrastructure to leverage**:
- `AgentWSService` at `admin/src/services/agentWSService.ts` already manages session tokens with 50min auto-renewal (of 60min server TTL) → persistent Agent session lifecycle must **align** with this cycle. Options: destroy/recreate Agent on session renewal, or keep Agent alive and only renew the auth token
- `Websocket` class at `backend/src/services/websocket/websocket.ts` already uses AbortController for run cancellation → **extend** for multi-turn lifecycle (don't abort between turns, only on WS disconnect)
- `IAgentRunnerDB` interface at `agent/src/types/runner.types.ts:15-28` is a narrow interface with only `listMessages` and `createMessage` → may need to add `updateMessage()` for compacted/summarized messages. Currently only creates, never updates
- Message persistence happens on `turn_end` events (runner.ts:111-129) → compacted messages should also be persisted (consider `EMsgType.compacted` or storing summary in `message.meta`)
- `convertToLlm` handler in pi-agent-core → custom messages (artifact, notification, systemEvent) **must** be filtered out so they never reach the LLM. The `convertToLlm` callback is the right place for this
- **Sandbox HARD REQUIREMENT**: The persistent Agent session must share a single `LocalSandbox` instance across turns. The sandbox is created once in `init()` (via `createSandboxProvider(ESandboxType.local)` → `LocalSandboxProvider.create()` → `LocalSandbox(Bash, InMemoryFs, IsolateRunner)`) and destroyed in `destroy()`. Between turns, the sandbox state (virtual filesystem, env vars) persists — this gives the agent continuity across prompts. The existing `ISandbox` interface is the only execution surface
- **Proxy HARD REQUIREMENT**: The persistent AgentRunner lives server-side in the backend. The WS connection from the client is authenticated via session token through the proxy. Session token renewal (every 50min) does NOT require destroying the AgentRunner — only the auth token refreshes, not the agent state

**Verification for Phase 4**:
- Unit tests for persistent session lifecycle
- Integration: Multiple prompts on same WS connection → verify agent state persists
- Integration: Long conversation → verify context compaction triggers
- Integration: Custom message type round-trip through DB and back

---

## Part 4: Code Replaceable by Pi-Mono

| Current TDSK Code | Replacement | Benefit |
|---|---|---|
| `buildFallbackModel.ts` (24 lines) | Keep, but use `getModels()` to reduce fallback cases | Fewer custom models |
| `ProviderTemplates[].models` hardcoded arrays | `getModels(provider)` — pi-mono sole source of truth | 200+ models, auto-updated, cost data, capabilities |
| `DynamicModels` class (5 fetch functions) | `getModels(provider)` — single universal call | Remove 5 provider-specific functions |
| `fetchModels.ts` 5-case switch | Single `ModelRegistry.getModels(brand)` | Unified, no per-provider branching |
| Admin static model dropdowns | Backend API call → pi-mono registry | Dynamic, always current |
| Hardcoded usage zeros in `websocket.ts` | `AssistantMessage.usage` + `calculateCost()` | Real cost tracking |
| No context management | `transformContext` + `isContextOverflow()` | Graceful handling |
| Per-request Agent creation | Persistent Agent with runtime mutation | Session continuity |
| Custom stream proxy (removed) | `streamProxy()` from pi-agent-core | Upstream maintained, preserves proxy-through-backend architecture |

**NOT replaceable** (must be preserved):
| Current TDSK Code | Why it must stay |
|---|---|
| `LocalSandbox` (InMemoryFs + Bash + IsolateRunner) | All tool execution depends on this. Pi-mono doesn't replace it |
| `FunctionExecutor.execute()` | Custom function execution in sandboxed V8. This IS the dynamic tool system |
| `createSandboxTools()` + `buildCustomFunctionTools()` | Tool registration pipeline. Already complete — no changes needed |
| Proxy → Backend → Agent request flow | Security architecture. All secrets server-side |
| `SecretResolver` | API key resolution. No pi-mono equivalent |
| `providers` DB table | Stores org-specific provider config (secretId, baseUrl, headers). Pi-mono replaces the model catalog, not provider credentials |
| `ProviderTemplates` (config only, NOT models) | Still needed for `baseUrl`, `apiKeyPlaceholder`, `apiKeyPattern`, `defaultSecretName`. Only the `models[]` arrays are removed |

---

### Phase 5: Rich Features (Fixes G16, G17 + new capabilities)

#### 5.1 File Attachment & Document Extraction (G16)

**Problem**: No file upload, no PDF/DOCX extraction, no image attachments in agent chat.

**Pi-mono APIs**: pi-web-ui's attachment handling pattern, pi-ai's `ImageContent`, `createExtractDocumentTool` pattern

**Existing infrastructure to leverage**:
- `repos/database/src/schemas/assets.ts` — Assets table already exists with exclusive arc (org/project/user/thread/message), JSONB `content` and `meta` fields → file attachments should create Asset records linked to thread+message
- `repos/admin/src/components/AI/AssetsTab.tsx` — Asset list/delete UI exists (download TODO) → **extend** with file preview/download rather than creating a separate file viewer
- `repos/domain/src/types/ai.types.ts` — `TMessageContent` union can be extended → new `TFileContent` type persists automatically via JSONB storage
- `TWSClientMsg.FileUpload` already exists in `domain/src/types/ws.types.ts` → repurpose or extend for file attachment flow. Alternatively, add `files` field to existing `Prompt` event payload
- `TWSClientMsg.WorkspaceManifest` also exists → may be relevant for workspace file management
- `convertToLlmMessages()` at `messageConverter.ts:16-96` → must handle `TFileContent` round-trip (extracted text as user context when sending to LLM, file reference when loading from DB)
- Message persistence on `turn_end` → file references in user messages are persisted with the message content[], not separately

**Files — Domain types**:
- `repos/domain/src/types/ai.types.ts`
  - Add `TFileContent` to `TMessageContent` union:
    ```typescript
    TFileContent = {
      type: 'file'
      assetId: string
      fileName: string
      fileType: string        // MIME type
      fileSize: number
      extractedText?: string  // Extracted text content for LLM context
    }
    ```
  - Add `EContentType.file = 'file'`
- `repos/domain/src/types/ws.types.ts`
  - Add file-related WS events:
    ```typescript
    EWSEventType.FileUploadComplete = 'file_upload_complete'
    ```
  - Add `files` field to WS prompt message: `files?: Array<{ name: string; data: string; mimeType: string }>`

**Files — Backend upload & extraction**:
- `repos/backend/src/services/files/fileExtractor.ts` — **New file**:
  - `extractText(buffer: Buffer, mimeType: string): Promise<string>`
  - PDF extraction via `pdf-parse` (npm package, lightweight)
  - Image OCR: skip for MVP, pass raw `ImageContent` to vision models instead
  - Plain text/markdown: direct passthrough
  - DOCX: via `mammoth` (npm package)
  - Configurable max extraction length (default 50KB text)
- `repos/backend/src/endpoints/threads/uploadFile.ts` — **New endpoint**:
  - `POST /_/threads/:threadId/files` (multipart/form-data)
  - Accept file upload, extract text, create Asset record
  - Return `{ assetId, fileName, fileType, extractedText }`
  - Size limit: 25MB per file
- `repos/backend/package.json` — Add `pdf-parse`, `mammoth` dependencies

**Files — Agent integration**:
- `repos/agent/src/types/runner.types.ts`
  - Add `files?: Array<{ assetId: string; fileName: string; extractedText?: string; imageData?: string; mimeType: string }>` to `TAgentRunOpts`
- `repos/agent/src/runner/runner.ts`
  - If `opts.files?.length`:
    - For image files → pass as `ImageContent[]` to `agent.prompt(prompt, images)`
    - For text/document files → prepend extracted text to prompt as context block:
      ```
      [Attached file: report.pdf]
      <extracted_content>
      ...extracted text...
      </extracted_content>
      ```
  - Save file references in user message to DB
- `repos/agent/src/adapters/messageConverter.ts`
  - Handle `TFileContent` in `convertToLlmMessages` — include extracted text as user context

**Files — Admin UI**:
- `repos/admin/src/components/AI/ChatView.tsx`
  - Add file upload button next to send button (hidden `<input type="file" multiple>`)
  - Accept: `.pdf,.docx,.png,.jpg,.jpeg,.gif,.txt,.md,.csv`
  - Drag-and-drop zone overlay on the chat area
  - Show file chips/previews before sending
  - Upload files to backend → get assetIds → include in WS prompt message
- `repos/admin/src/components/AI/FilePreview.tsx` — **New component**:
  - Thumbnail + filename + size for attached files
  - Image preview for image attachments
  - "View extracted text" collapsible for documents
- `repos/admin/src/components/AI/MessageBubble.tsx`
  - Extend to render `TFileContent` blocks: show file attachment with download link
- `repos/admin/src/services/filesApi.ts` — **New service**:
  - `uploadFile(threadId: string, file: File): Promise<TFileUploadResult>`
  - Multipart upload to `/_/threads/:threadId/files`

#### 5.2 Artifact System (G17)

**Problem**: Agents can't produce interactive HTML/SVG/Markdown that renders in the admin UI.

**Pi-mono APIs**: pi-agent-core `CustomAgentMessages` (from Phase 4.3), pi-web-ui's `ArtifactsPanel` pattern

**Depends on**: Phase 4.3 (custom message types)

**Approach**: Agents produce artifact content blocks in their output. The admin UI detects these and renders them in a sandboxed panel.

**Files — Domain types**:
- `repos/domain/src/types/ai.types.ts`
  - Add `TArtifactContent` to `TMessageContent` union:
    ```typescript
    TArtifactContent = {
      type: 'artifact'
      artifactType: 'html' | 'svg' | 'markdown' | 'code' | 'json' | 'csv'
      content: string           // Raw content
      title?: string
      language?: string         // For code artifacts
    }
    ```
  - Add `EContentType.artifact = 'artifact'`
- `repos/domain/src/types/ws.types.ts`
  - Add `EWSEventType.Artifact` event for streaming artifact content

**Existing infrastructure to leverage**:
- **Sandbox HARD REQUIREMENT**: `ISandbox.evaluate()` from `@tdsk/sandbox` → for HTML artifact server-side validation/sandboxing before sending to client. The existing V8 isolate (`IsolateRunner`) can safely execute artifact code. If the `createArtifact` tool needs to validate/transform HTML/SVG before streaming to the client, it **MUST** use `sandbox.evaluate()` — NOT a new sandboxing mechanism. The V8 isolate already provides: memory-limited execution, timeout enforcement, no host filesystem access (virtual fs only), and shimmed Node.js APIs
- `ToolCallDisplay.tsx` at `admin/src/components/AI/ToolCallDisplay.tsx` uses an expandable accordion pattern (tool name, status, args, result) → **follow same UX pattern** for artifact rendering (expandable, content display, status indicators)
- `createSandboxTools()` at `agent/src/tools/tools.ts` → the `createArtifact` tool definition should follow the same `AgentTool` interface and registration pattern as existing sandbox tools. It must be registered via `getToolDefs()` and filtered via `allowedTools` — the same mechanism all sandbox tools use
- `TMessageContent` union → `TArtifactContent` extends the existing union, persists automatically via JSONB
- `convertAssistantToContent()` at `messageConverter.ts:101-119` → must handle artifact content blocks from pi-mono AssistantMessage

**Files — Agent**:
- `repos/agent/src/adapters/eventBridge.ts`
  - Detect artifact patterns in assistant text output (```html, ```svg blocks, or explicit artifact tool output)
- `repos/agent/src/adapters/messageConverter.ts`
  - Persist `TArtifactContent` blocks to DB
  - Restore from DB for conversation history
- `repos/agent/src/tools/definitions/artifact/` — **New tool definition** (optional):
  - `createArtifact` tool: allows agent to explicitly produce artifacts
  - Parameters: `{ type: 'html'|'svg'|'markdown', content: string, title: string }`
  - This gives the agent a structured way to produce artifacts vs. inline code blocks

**Files — Admin UI**:
- `repos/admin/src/components/AI/ArtifactRenderer.tsx` — **New component**:
  - Switch on `artifactType`:
    - `html`/`svg`: Render in sandboxed `<iframe>` with `sandbox="allow-scripts"` and CSP
    - `markdown`: Render with `react-markdown` or `marked`
    - `code`: Render with Monaco editor (read-only, syntax highlighted)
    - `json`: Pretty-printed collapsible tree
    - `csv`: Simple table rendering
  - "Copy" and "Download" buttons on each artifact
  - "Open in new tab" for HTML artifacts
- `repos/admin/src/components/AI/MessageBubble.tsx`
  - Detect `TArtifactContent` in message content
  - Render inline `<ArtifactRenderer>` component
- `repos/admin/src/components/AI/ArtifactPanel.tsx` — **New component** (optional):
  - Side panel (like pi-web-ui's ArtifactsPanel) for full-screen artifact viewing
  - Toggle between chat view and artifact view

#### 5.3 pi-web-ui Component Embedding in Admin

**Problem**: Admin chat is custom React+MUI. pi-web-ui offers richer chat components out of the box.

**Pi-mono APIs**: `<chat-panel>`, `<agent-interface>`, `<model-selector>` web components

**Status**: pi-web-ui is NOT currently installed. Needs to be added as a dependency.

**Approach**: Embed pi-web-ui web components inside React via refs. Use selectively — don't replace the entire admin, embed specific components where they add value.

**Files — Setup**:
- `repos/admin/package.json`
  - Add `@mariozechner/pi-web-ui` dependency
  - Already has `@mariozechner/pi-ai` and `@mariozechner/pi-agent-core` as transitive deps via `@tdsk/agent`
- `repos/admin/src/types/pi-web-ui.d.ts` — **New file**:
  - Declare JSX intrinsic elements for TypeScript:
    ```typescript
    declare namespace JSX {
      interface IntrinsicElements {
        'chat-panel': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
        'agent-interface': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
        'model-selector': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement>, HTMLElement>
      }
    }
    ```
- `repos/admin/src/utils/piWebUiLoader.ts` — **New file**:
  - Lazy-load pi-web-ui to register custom elements on demand:
    ```typescript
    let loaded = false
    export async function loadPiWebUi() {
      if (loaded) return
      await import('@mariozechner/pi-web-ui')
      loaded = true
    }
    ```

**Files — Component wrappers**:
- `repos/admin/src/components/AI/PiModelSelector.tsx` — **New component**:
  - React wrapper around `<model-selector>` custom element
  - Use `useRef` to call `ModelSelector.open(currentModel, onSelect)` imperatively
  - Wire to Jotai agent state for model selection
  - Replace current manual model dropdown in agent config
- `repos/admin/src/components/AI/PiArtifactsPanel.tsx` — **New component**:
  - React wrapper around pi-web-ui's artifacts panel
  - Receive artifact content from message stream
  - Render in side panel alongside chat
  - Handles HTML/SVG sandboxing natively (pi-web-ui does this internally)
- `repos/admin/src/components/AI/PiChatPanel.tsx` — **New component** (optional, for standalone agent pages):
  - Full `<chat-panel>` wrapper for pages that want the pi-web-ui chat experience
  - Configure with ThreadedStack's Agent instance + streamFn
  - Wire callbacks: `onApiKeyRequired` → TDSK secret resolution, `onBeforeSend` → DB persistence

**Existing infrastructure to leverage**:
- Jotai atoms `agentsState`, `threadsState` at `admin/src/state/` → pi-web-ui components must bridge to existing Jotai state for model selection, agent config. Don't create separate state
- `agentsApi.createSession()` at `admin/src/services/agentsApi.ts` → pi-web-ui's `onApiKeyRequired` callback should use existing session token flow
- Admin's MUI theme at `admin/src/theme/` → CSS variable overrides bridge MUI → pi-web-ui

**Theming considerations**:
- pi-web-ui uses Tailwind CSS v4 + CSS variables
- Admin uses MUI with custom theme
- Solution: Import pi-web-ui CSS in a scoped container (Shadow DOM or CSS scope)
- Override CSS variables to match MUI theme colors:
  ```css
  chat-panel {
    --primary: var(--mui-palette-primary-main);
    --background: var(--mui-palette-background-default);
  }
  ```

#### 5.4 streamProxy() for REPL Proxy Mode

**Problem**: The custom `createStreamProxy()` was removed from `repos/agent/src/stream/`. Pi-agent-core has a built-in `streamProxy()` that could serve the REPL's proxy needs.

**Pi-mono APIs**: `streamProxy()` from `@mariozechner/pi-agent-core`

**CRITICAL — Proxy architecture preservation**: The REPL uses `streamProxy()` specifically to route ALL LLM requests through the backend. The flow is: REPL → `streamProxy()` → Backend `/ai/stream` → LLM provider. This ensures:
1. **Secrets stay server-side** — the REPL never has direct LLM API keys
2. **Auth is enforced** — session tokens validate through the proxy auth layer
3. **All requests are auditable** — every LLM call passes through the backend
This is the **designed proxy pattern** and MUST be preserved. `streamProxy()` replaces a custom implementation but maintains the same architecture: client-side agent streams through backend, never directly to LLM providers.

**Existing infrastructure to leverage**:
- REPL `Executor` class at `repl/src/services/executor.ts` already manages session tokens with 55min caching (of 60min server TTL) → `streamProxy()` should use the **same** session token auth pattern, not a separate auth mechanism
- Session creation at `repl/src/services/api.ts` via `createSession()` → reuse for streamProxy auth token acquisition
- Backend `/ai/stream` endpoint uses session token auth (`Authorization: Session <token>`) → streamProxy must use this exact auth header format
- The backend `/ai/stream` endpoint receives the proxied stream, resolves secrets via `SecretResolver`, and makes the actual LLM call — the REPL never touches API keys

**Files**:
- `repos/agent/src/runner/runner.ts`
  - When `proxyConfig` is provided (REPL mode), use pi-agent-core's `streamProxy()`:
    ```typescript
    import { streamProxy } from '@mariozechner/pi-agent-core'

    const streamFn = proxyConfig
      ? (model, context, options) => streamProxy(model, context, {
          ...options,
          authToken: proxyConfig.sessionToken,
          proxyUrl: proxyConfig.backendUrl,
        })
      : customStreamFn // from Phase 1.3
    ```
  - This replaces the need for any custom stream proxy implementation
  - **Note**: The `proxyUrl` points to the backend's `/ai/stream` endpoint (via Caddy TLS). The backend handles secret resolution and LLM provider calls. The REPL only has a session token, never API keys
- `repos/agent/src/types/runner.types.ts`
  - Re-add `proxyConfig?: TProxyConfig` to `TAgentRunOpts` (if not already present)

**Verification for Phase 5**:
- Upload a PDF via admin chat → verify extracted text appears in agent context
- Upload an image → verify vision model receives it as `ImageContent`
- Agent produces HTML artifact → verify sandboxed rendering in admin
- `<model-selector>` renders inside React page with MUI theme match
- REPL proxy mode uses `streamProxy()` → verify LLM calls route through backend

---

### Phase 6: Platform Extensions

#### 6.1 Skills System for Agents

**Problem**: Agents have static system prompts and tools. No way to dynamically extend agent capabilities based on context or user-defined skills.

**Pi-mono pattern**: pi-coding-agent's SKILL.md files — standardized capability definitions with trigger conditions, instructions, and tool sets. Skills auto-activate based on user intent.

**Approach**: Adapt the SKILL.md pattern to ThreadedStack's agent system. Skills are stored in the database and injected into agent system prompts dynamically.

**Existing infrastructure to leverage**:
- **Sandbox HARD REQUIREMENT**: ALL tools activated by skills execute in the existing `LocalSandbox` (InMemoryFs + Bash + IsolateRunner). Skills do NOT create new sandboxes or execution environments. When a skill activates additional tools, those tools call `sandbox.exec()`, `sandbox.readFile()`, `sandbox.writeFile()`, `sandbox.evaluate()`, etc. on the **same** `ISandbox` instance used by the agent's base tools. The execution stack is: Skill activates tool → `createSandboxTools(sandbox, mergedToolList)` → tool.execute() calls `sandbox.*` methods → `LocalSandbox` delegates to `Bash` (shell), `InMemoryFs` (filesystem), or `IsolateRunner` (code eval)
- `createSandboxTools(sandbox, allowedTools?)` at `agent/src/tools/tools.ts:11-240` → Skill `tools[]` field activates additional sandbox tools. **MUST** use the existing `allowedTools` filter mechanism. When a skill activates, merge its tools with the agent's base tools list, then pass to `createSandboxTools(sandbox, mergedToolList)`
- `ISandbox.evaluate()` from `@tdsk/sandbox` → skill code execution (if skills have code handlers) must run in the **same** sandbox instance as agent tools, not a separate V8 isolate. Skills with custom code run via `FunctionExecutor.execute()` which creates its own sandbox per function — this is the existing pattern for custom function execution and should be reused
- `agentFunctions` junction table pattern at `database/src/schemas/agentFunctions.ts` → `agentSkills` junction should follow the **exact same** pattern: nanoid10 PK, agentId+skillId unique constraint, cascade deletes
- `agentProjects.functionIds[]` pattern → consider `agentProjects.skillIds[]` for per-project skill activation, giving project-level control over which skills are active
- `Agent.getEffectiveConfig(projectId)` → skills should integrate with the project override pattern for per-project skill activation
- `getToolDefs()` at `agent/src/tools/definitions/definitions.ts` → central tool registry with allowedTools filter. Skills merging additional tools should go through this same registry
- Admin `DataTable + Drawer` pattern (OrgAgents page + AgentDrawer) → Skills list page should use **same** pattern
- Admin `Monaco editor` for systemPrompt in AgentDrawer → skill instructions editor should reuse Monaco
- Admin `ToolsSelector` multi-select in AgentDrawer → skill tool selection should reuse this component
- Admin tab pattern on detail pages (AgentDetailTab, ThreadsTab, etc.) → new SkillsTab follows same pattern

**Files — Domain types**:
- `repos/domain/src/types/agent.types.ts`
  - Add `TAgentSkill` type:
    ```typescript
    TAgentSkill = {
      id: string
      name: string
      description: string         // Short description for agent selection
      triggerKeywords?: string[]   // Keywords that auto-activate this skill
      instructions: string         // Full skill instructions (markdown)
      tools?: string[]             // Additional tools to enable when skill active
      alwaysActive?: boolean       // Always include in system prompt
    }
    ```
  - Add `skills?: TAgentSkill[]` to Agent model or as junction table
- `repos/domain/src/models/skill.ts` — **New model**:
  - Skill class extending Base with the above fields

**Files — Database**:
- `repos/database/src/schemas/skills.ts` — **New schema**:
  - `skills` table: `id`, `name`, `description`, `triggerKeywords` (JSONB), `instructions` (text), `tools` (JSONB), `alwaysActive` (boolean), `orgId`, `createdAt`, `updatedAt`
- `repos/database/src/schemas/agentSkills.ts` — **New junction table**:
  - `agentSkills`: `agentId`, `skillId` (many-to-many)
- `repos/database/src/schemas/index.ts` — Export new schemas

**Files — Backend**:
- `repos/backend/src/endpoints/skills/` — **New endpoint group**:
  - `GET /_/skills` — List skills for org
  - `POST /_/skills` — Create skill
  - `PUT /_/skills/:id` — Update skill
  - `DELETE /_/skills/:id` — Delete skill
  - `POST /_/agents/:id/skills` — Attach skill to agent
  - `DELETE /_/agents/:id/skills/:skillId` — Detach skill from agent
- `repos/backend/src/services/skills/skillResolver.ts` — **New service**:
  - `resolveActiveSkills(agent, prompt): TAgentSkill[]`
  - Returns always-active skills + keyword-triggered skills matching the user prompt
  - Injects skill instructions into system prompt dynamically:
    ```
    ## Active Skills
    ### {skill.name}
    {skill.instructions}
    ```

**Files — Agent**:
- `repos/agent/src/runner/runner.ts`
  - Before creating Agent, call `resolveActiveSkills()` to get active skills
  - Append skill instructions to `systemPrompt`
  - Merge skill `tools` with agent `tools`
- `repos/agent/src/types/runner.types.ts`
  - Add `skills?: TAgentSkill[]` to `TAgentRunOpts`

**Files — Admin UI**:
- `repos/admin/src/pages/Skills/` — **New page**:
  - Skill list view with CRUD
  - Skill editor: Monaco editor for markdown instructions
  - Trigger keyword configuration
  - Tool selection per skill
- `repos/admin/src/components/Agents/SkillsTab.tsx` — **New component**:
  - Tab on agent detail page to manage attached skills
  - Drag-and-drop ordering for skill priority

#### 6.2 Thread Branching UI Enhancement

**Problem**: Thread branching backend exists (`parentThreadId`, `branchMessageId` in schema, `branchThread` endpoint, `useMessageActions.onBranchClick` in admin) but the UI doesn't expose it well.

**Pi-mono pattern**: pi-coding-agent's JSONL session trees with `/tree` and `/fork` commands.

**Existing infrastructure** (already implemented):
- `repos/database/src/schemas/threads.ts` — `parentThreadId` (varchar, nullable), `branchMessageId` (varchar, nullable), relations `parentThread` and `branches`
- `repos/backend/src/endpoints/threads/branchThread.ts` — `POST /:orgId/agents/:agentId/threads/:threadId/branch` with `{ messageId }`
- `repos/admin/src/hooks/chat/useMessageActions.ts` — `onBranchClick` handler

**Files — Admin UI enhancements**:
- `repos/admin/src/components/AI/ThreadTree.tsx` — **New component**:
  - Visual tree/graph showing thread hierarchy
  - Root thread → branch threads with branch point indicators
  - Click to navigate between branches
  - Show branch metadata: creation time, message count, divergence point
- `repos/admin/src/components/AI/MessageBubble.tsx`
  - Add "Branch here" context menu item (wire to existing `onBranchClick`)
  - Visual indicator when a message is a branch point (fork icon)
- `repos/admin/src/components/AI/MessagesTab.tsx`
  - Add branch navigation: "Parent thread" link, "Branches from this thread" list
  - Branch count badge on thread list items
- `repos/admin/src/hooks/chat/useThreadTree.ts` — **New hook**:
  - Fetch thread with its branches: `GET /_/threads/:threadId?include=branches,parent`
  - Build tree structure for rendering

**Existing infrastructure to leverage (REPL)**:
- Slash command pattern at `repl/src/commands/*.ts` → each command exports a function, registered in commands index. New `/tree` and `/fork` commands **must** follow this exact pattern
- `ApiClient` class at `repl/src/services/api.ts` → already has `listThreads()`, `getThread()`, `createThread()` → use for tree/fork API calls. May need to add `branchThread()` method
- `useMessageActions.onBranchClick` in admin already works → REPL fork is the terminal equivalent of this existing admin action

**Files — REPL**:
- `repos/repl/src/commands/tree.ts` — **New slash command**:
  - `/tree` — Display ASCII tree of thread branches
  - Fetch thread hierarchy from backend API
  - Show branch points with message previews
- `repos/repl/src/commands/fork.ts` — **New slash command**:
  - `/fork` — Branch current thread at last message
  - `/fork <messageId>` — Branch at specific message
  - Call `POST /threads/:id/branch` API
  - Switch chat context to new branch

**Files — Backend enhancement**:
- `repos/backend/src/endpoints/threads/getThread.ts`
  - Add `?include=branches,parent` query param support
  - Return thread with nested `branches[]` and `parentThread` data

#### 6.3 pi-tui for REPL

**Problem**: REPL uses Ink (React TUI) for terminal rendering. pi-tui offers differential rendering, image support, IME, and autocomplete.

**Pi-mono package**: `@mariozechner/pi-tui` — Buffer-based differential rendering, Editor with autocomplete, Image rendering (Kitty/iTerm2), SelectList, Loader, Markdown rendering

**Current REPL rendering** (Ink-based):
- `repos/repl/src/components/ChatSession/ChatSession.tsx` — Main chat layout
- `repos/repl/src/components/Message/{User,Assistant,Error}.tsx` — Message renderers
- `repos/repl/src/components/Streaming/Streaming.tsx` — Character-by-character streaming
- `repos/repl/src/components/Prompt/Prompt.tsx` — Input with readline-like editing

**Approach**: Replace Ink rendering layer with pi-tui. This is a significant rewrite of the REPL's display layer but preserves all business logic (commands, API calls, auth).

**Existing infrastructure to leverage (MUST PRESERVE)**:
- `Executor` class at `repl/src/services/executor.ts` → WS agent runner with session caching (55min TTL), event processing. **MUST be preserved verbatim** — this is business logic, not rendering
- `ApiClient` class at `repl/src/services/api.ts` → HTTP wrapper with all CRUD ops. **MUST be preserved verbatim**
- Config loading via `@keg-hub/parse-config` chain (values.yaml → values.local.yaml → ~/.config/tdsk/values.yaml) → **MUST be preserved**
- All slash commands at `repl/src/commands/*.ts` → **MUST be preserved**, only re-wire to new rendering
- Auth system (`AuthManager`, `repl-auth.json`) → **MUST be preserved**
- This is strictly a **rendering-only migration**: replace Ink components with pi-tui equivalents while keeping all service/business logic unchanged
- Consider phased migration: keep both rendering backends initially, switch via config flag for safe rollback

**Files**:
- `repos/repl/package.json`
  - Add `@mariozechner/pi-tui` dependency
  - Keep `ink` temporarily for gradual migration (or replace entirely)
- `repos/repl/src/tui/` — **New directory** for pi-tui rendering layer:
  - `repos/repl/src/tui/ChatView.ts` — Main chat view using pi-tui Container + Text
  - `repos/repl/src/tui/MessageList.ts` — Message rendering with pi-tui Markdown component
  - `repos/repl/src/tui/InputEditor.ts` — Input using pi-tui Editor (multi-line, autocomplete for slash commands)
  - `repos/repl/src/tui/ImageRenderer.ts` — Inline image rendering (Kitty/iTerm2 protocol)
  - `repos/repl/src/tui/StatusBar.ts` — Status bar with pi-tui Text
  - `repos/repl/src/tui/index.ts` — Entry point replacing Ink `render()`
- `repos/repl/src/tasks/chat.ts`
  - Replace `render(<App>)` Ink call with pi-tui screen initialization

**Benefits**:
- Differential rendering (3 strategies: full, diff, delta) — no flickering
- Editor with file path autocomplete, history, multi-line editing
- Inline image rendering for vision model responses
- IME support for CJK input
- Markdown rendering with terminal colors and formatting

#### 6.4 Event Scheduling (Cron-Triggered Agents)

**Problem**: Agents only run on user prompt. No way to trigger agents on a schedule for monitoring, reporting, or autonomous workflows.

**Pi-mono pattern**: pi-mom's cron-based event scheduling for autonomous agent runs.

**Existing infrastructure to leverage**:
- `AgentEndpoint.run()` at `backend/src/services/endpoints/agentEndpoint.ts` → the scheduler must resolve agent config the **same way**: load agent (unsanitized), apply project overrides via `getEffectiveConfig()`, resolve secrets via SecretResolver, load functions, create sandbox. **Extract a shared helper** from AgentEndpoint.run() that both the endpoint and scheduler call, rather than reimplementing
- **Sandbox HARD REQUIREMENT**: Scheduled agent runs use the same `createSandboxProvider(ESandboxType.local)` → `LocalSandbox(Bash, InMemoryFs, IsolateRunner)` pipeline as user-triggered runs. The shared helper extracted from AgentEndpoint.run() must create the sandbox identically. Tools in scheduled runs execute via `createSandboxTools(sandbox)` + `buildCustomFunctionTools()` using `FunctionExecutor.execute()` — the same execution paths as interactive runs
- **Proxy HARD REQUIREMENT**: Scheduled runs execute server-side within the backend process. They call `AgentRunner.run()` directly (not through the proxy/WS). Since the scheduler IS the backend, no proxy hop is needed. But secrets are still resolved by `SecretResolver`, and `streamFn` still calls LLM providers with resolved API keys — the same server-side pattern
- Quota service at `backend/src/services/quotas/` → scheduler **must** check quotas before each scheduled run (don't exceed message/runtime limits). Scheduled runs count toward org quotas
- Database schema patterns → nanoid10 IDs, orgId FK with cascade, timestamps with `$onUpdate()`
- Admin `DataTable + Drawer` pattern → Schedules list page should use same pattern
- Admin tab pattern → new SchedulesTab on agent detail page follows same pattern as ThreadsTab, AssetsTab

**Files — Domain types**:
- `repos/domain/src/types/agent.types.ts`
  - Add `TAgentSchedule` type:
    ```typescript
    TAgentSchedule = {
      id: string
      agentId: string
      orgId: string
      cronExpression: string     // e.g., "0 9 * * MON" (9am every Monday)
      prompt: string             // The prompt to send on trigger
      enabled: boolean
      lastRunAt?: string
      nextRunAt?: string
      threadId?: string          // Optional: append to existing thread
      createThread?: boolean     // Create new thread per run (default true)
      maxConsecutiveErrors?: number  // Disable after N consecutive failures
      consecutiveErrors?: number
    }
    ```
- `repos/domain/src/models/schedule.ts` — **New model**

**Files — Database**:
- `repos/database/src/schemas/schedules.ts` — **New schema**:
  - `schedules` table: all fields from `TAgentSchedule` + timestamps
  - Index on `enabled + nextRunAt` for efficient polling
  - Foreign keys to agents and orgs

**Files — Backend**:
- `repos/backend/src/endpoints/schedules/` — **New endpoint group**:
  - `GET /_/schedules` — List schedules for org
  - `POST /_/schedules` — Create schedule
  - `PUT /_/schedules/:id` — Update schedule
  - `DELETE /_/schedules/:id` — Delete schedule
  - `POST /_/schedules/:id/trigger` — Manual trigger
- `repos/backend/src/services/scheduler/scheduler.ts` — **New service**:
  - Polling-based scheduler (runs every 60s)
  - Query: `SELECT * FROM schedules WHERE enabled = true AND nextRunAt <= NOW()`
  - For each due schedule:
    1. Create or reuse thread
    2. Build `TAgentRunOpts` from agent config
    3. Call `AgentRunner.run()` with schedule prompt
    4. Update `lastRunAt`, calculate `nextRunAt` from cron expression
    5. On error: increment `consecutiveErrors`, disable if threshold reached
  - Use `cron-parser` npm package for cron expression parsing
  - Lightweight — no separate process, runs in backend event loop
- `repos/backend/src/services/scheduler/cronParser.ts` — **New file**:
  - `parseNextRun(cronExpression: string): Date`
  - `isValidCron(expression: string): boolean`
- `repos/backend/package.json` — Add `cron-parser` dependency
- `repos/backend/src/main.ts` — Start scheduler on backend boot

**Files — Admin UI**:
- `repos/admin/src/pages/Schedules/` — **New page**:
  - Schedule list with enable/disable toggles
  - Create/edit form: agent selector, cron expression builder, prompt editor
  - Run history (last N runs with status/output)
  - Manual trigger button
- `repos/admin/src/components/Agents/SchedulesTab.tsx` — **New component**:
  - Tab on agent detail page showing schedules for that agent

**Files — Quota integration**:
- `repos/backend/src/services/scheduler/scheduler.ts`
  - Check quotas before each scheduled run (don't exceed message/runtime limits)
  - Scheduled runs count toward org quotas

#### 6.5 Custom Functions as Dynamic Agent Tools — Already Implemented

**This is not a new feature.** Custom functions already ARE dynamic tools. The existing system provides everything needed:

- `FunctionModel` — has `name`, `description`, `inputSchema`, `content` (code), `language`, `defaultArgs`, `dependencies`. This IS a tool definition + handler.
- `buildCustomFunctionTools()` at `agent/src/tools/tools.ts` — already converts `FunctionModel[]` → `AgentTool[]` via `onExecuteFunction` callback
- `FunctionExecutor.execute()` at `backend/src/services/functions/functionExecutor.ts` — already executes function code in sandboxed V8 isolate (esbuild transpilation → `createSandboxProvider()` → `ISandbox.evaluate()` → 1MB output cap → cleanup)
- `agentFunctions` junction table — already associates functions with agents
- Admin Functions UI — already provides CRUD with Monaco editor for code, schema builder for inputs
- FaaS endpoints — already provide webhook/HTTP-triggered function execution for external callers

**No new tables, no new columns, no new builders, no extensions needed.** The pipeline is: user creates a function → attaches it to an agent via `agentFunctions` → `buildCustomFunctionTools()` makes it available as an `AgentTool` → agent calls it → `FunctionExecutor.execute()` runs it in the existing sandbox. This is the designed purpose of the custom functions system.

**What this phase ensures**: As pi-mono capabilities are integrated (skills in 6.1, new pi-mono tool types, etc.), ALL custom tool execution continues to flow through this existing pipeline. No new execution paths are created. Custom functions remain the single mechanism for user-defined tools.

**Verification for Phase 5 & 6**:
- Upload PDF → verify extraction → agent receives extracted text
- Upload image → verify vision model processes it via `ImageContent`
- Agent produces HTML → sandboxed iframe renders safely in admin (artifact validation uses `ISandbox.evaluate()`)
- `<model-selector>` renders inside React with MUI theme
- REPL `/fork` → creates branch → navigates to new thread
- Create schedule → wait for cron trigger → verify agent runs on time (same sandbox pipeline)
- Create skill with trigger keywords → send matching prompt → verify skill activates (tools execute in existing sandbox)
- pi-tui REPL renders messages with markdown formatting and images
- Create custom function → attach to agent → verify agent can call it as a tool → execution flows through `FunctionExecutor.execute()` → `ISandbox.evaluate()`
- Verify ALL tool calls (sandbox tools, custom functions) flow through existing execution infrastructure

---

## Part 5: Key Files Reference

| File | Phases Affected |
|------|----------------|
| **Agent repo** | |
| `repos/agent/src/runner/runner.ts` | 0–6 (all phases) |
| `repos/agent/src/adapters/eventBridge.ts` | 1.1, 3.1, 5.2 |
| `repos/agent/src/adapters/messageConverter.ts` | 3.1, 3.2, 4.3, 5.1, 5.2 |
| `repos/agent/src/types/runner.types.ts` | 2.3, 3.2, 3.3, 5.1, 5.4, 6.1 |
| `repos/agent/src/tools/tools.ts` | 6.1, 6.5 |
| `repos/agent/package.json` | 0 |
| **Domain repo** | |
| `repos/domain/src/types/ai.types.ts` | 1.1, 3.1, 3.2, 4.3, 5.1, 5.2 |
| `repos/domain/src/types/ws.types.ts` | 1.1, 3.1, 3.2, 3.3, 4.1, 5.1 |
| `repos/domain/src/types/agent.types.ts` | 1.2, 2.1, 3.1, 4.2, 6.1, 6.4, 6.5 |
| **Backend repo** | |
| `repos/backend/src/services/websocket/websocket.ts` | 1.1, 3.1, 3.2, 3.3, 4.1 |
| `repos/backend/src/endpoints/ai/onWSConnect.ts` | 3.3, 4.1 |
| `repos/backend/src/services/endpoints/agentEndpoint.ts` | 1.1, 3.1, 3.2 |
| `repos/backend/src/services/providers/dynamicModels.ts` | 1.4 (replaced with ModelRegistry) |
| `repos/backend/src/endpoints/threads/getThread.ts` | 6.2 |
| `repos/backend/package.json` | 0, 5.1, 6.4 |
| **Admin repo** | |
| `repos/admin/src/hooks/chat/useAgentChat.ts` | 3.1, 3.2, 3.3, 5.1 |
| `repos/admin/src/components/AI/ChatView.tsx` | 5.1, 5.3 |
| `repos/admin/src/components/AI/MessageBubble.tsx` | 5.1, 5.2, 6.2 |
| `repos/admin/src/services/agentWSService.ts` | 3.3, 5.1 |
| `repos/admin/package.json` | 5.3 |
| **REPL repo** | |
| `repos/repl/src/tasks/chat.ts` | 6.3 |
| `repos/repl/src/components/ChatSession/ChatSession.tsx` | 6.3 |
| `repos/repl/package.json` | 6.3 |
| **Database repo** | |
| `repos/database/src/schemas/threads.ts` | 6.2 (already has branching fields) |
| `repos/database/src/schemas/assets.ts` | 5.1 (already exists) |
| **New files** | |
| `repos/agent/src/utils/contextManager.ts` | 2.1, 4.2 |
| `repos/agent/src/utils/errorClassifier.ts` | 2.3 |
| `repos/agent/src/types/customMessages.ts` | 4.3 |
| `repos/backend/src/services/files/fileExtractor.ts` | 5.1 |
| `repos/backend/src/endpoints/threads/uploadFile.ts` | 5.1 |
| `repos/admin/src/components/AI/FilePreview.tsx` | 5.1 |
| `repos/admin/src/components/AI/ArtifactRenderer.tsx` | 5.2 |
| `repos/admin/src/components/AI/PiModelSelector.tsx` | 5.3 |
| `repos/admin/src/components/AI/PiArtifactsPanel.tsx` | 5.3 |
| `repos/admin/src/components/AI/ThreadTree.tsx` | 6.2 |
| `repos/admin/src/services/filesApi.ts` | 5.1 |
| `repos/admin/src/types/pi-web-ui.d.ts` | 5.3 |
| `repos/admin/src/utils/piWebUiLoader.ts` | 5.3 |
| `repos/backend/src/services/scheduler/scheduler.ts` | 6.4 |
| `repos/backend/src/endpoints/schedules/` | 6.4 |
| `repos/backend/src/endpoints/skills/` | 6.1 |
| `repos/backend/src/services/skills/skillResolver.ts` | 6.1 |
| `repos/database/src/schemas/skills.ts` | 6.1 |
| `repos/database/src/schemas/agentSkills.ts` | 6.1 |
| `repos/database/src/schemas/schedules.ts` | 6.4 |
| `repos/database/src/schemas/functions.ts` | 6.5 (no changes — already implements dynamic tools) |
| `repos/domain/src/models/skill.ts` | 6.1 |
| `repos/domain/src/models/schedule.ts` | 6.4 |
| `repos/repl/src/commands/tree.ts` | 6.2 |
| `repos/repl/src/commands/fork.ts` | 6.2 |
| `repos/repl/src/tui/` | 6.3 |

---

## Part 6: Verification Strategy

For each phase:

1. **Unit tests** — `pnpm test` in affected repos (agent, backend, domain)
2. **Type checks** — `pnpm types` across all repos
3. **Build validation** — `pnpm build` in dependency order (domain → database → logger → agent → backend → admin)
4. **Integration tests** — Against live K8s:

| Phase | Verification |
|-------|-------------|
| 0 | All existing tests pass after upgrade; type checks clean |
| 1 | Send chat → TurnEnd has non-zero `usage` and `cost`; temperature applied |
| 2 | 100+ message conversation → context prunes gracefully; overflow detected; retry works |
| 3 | Thinking events stream; image upload via WS works; steering redirects mid-tool |
| 4 | Multiple prompts on same WS → agent persists; compaction triggers; custom messages round-trip |
| 5 | PDF upload → extracted text in context; artifact → sandboxed render; `<model-selector>` in React; REPL proxy via `streamProxy()` |
| 6 | Skill activates on keyword; `/fork` creates branch; scheduled agent runs on cron; custom functions work as agent tools via existing pipeline |

**New npm dependencies across all phases**:
- `repos/backend/package.json`: `pdf-parse`, `mammoth`, `cron-parser`
- `repos/admin/package.json`: `@mariozechner/pi-web-ui`
- `repos/repl/package.json`: `@mariozechner/pi-tui`

---

## Part 7: Anti-Duplication Quick Reference

> Detailed integration points are embedded within each phase above. This table is a quick-reference safety check.

| Plan Item | Duplication Risk | Resolution |
|-----------|-----------------|------------|
| 6.5 dynamic tools | Could create new table/builder/executor | **Nothing to build** — custom functions already ARE dynamic tools. `FunctionModel` → `buildCustomFunctionTools()` → `FunctionExecutor.execute()` → `ISandbox.evaluate()`. FaaS endpoints handle HTTP-triggered execution. No changes needed |
| 6.1 skill tool execution | Could bypass sandbox | ALL skill tools execute via `createSandboxTools(sandbox)` on the existing `LocalSandbox` (InMemoryFs + Bash + IsolateRunner). No new sandbox |
| 6.1 skill code execution | Could bypass FunctionExecutor | Skill code handlers use `FunctionExecutor.execute()` — same as custom functions |
| 5.2 artifact code execution | Could create new sandbox | Artifact validation uses `ISandbox.evaluate()` on the agent's existing sandbox. No new V8 isolate |
| 5.1 file upload WS event | `FileUpload` already in TWSClientMsg | Extend existing event or add `files` to Prompt payload |
| 3.2 image upload | Separate pipeline | Use Assets table with exclusive arc |
| 4.1 session lifecycle | Separate management | Align with AgentWSService 50min renewal. Sandbox persists across turns |
| 6.3 REPL rewrite | Losing business logic | Rendering-only migration; preserve Executor/ApiClient/config |
| 6.4 scheduler orchestration | Reimplemented agent setup | Extract shared helper from AgentEndpoint.run(). Same sandbox pipeline |
| ALL phases | Direct LLM access bypassing proxy | **NEVER** — all LLM calls go through `streamFn` (server-side) or `streamProxy()` (REPL → backend). Secrets stay in backend |
