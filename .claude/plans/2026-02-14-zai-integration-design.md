# Z.AI Integration + OpenAI-Compatible Base Adapter

**Date**: 2026-02-14
**Status**: Approved
**Scope**: Full platform (domain, agent, backend, admin)

## Problem

The agent repo supports 3 LLM providers (Anthropic, OpenAI, Google) via dedicated adapters. Adding new OpenAI-compatible providers (z.ai, Grok, Together, etc.) requires duplicating the OpenAI adapter's SSE parsing, message transformation, and tool call handling each time.

## Goals

1. Add z.ai (GLM-5/4.7/4.6/4.5) as a supported LLM provider across the platform
2. Extract a reusable `OpenAICompatibleAdapter` base class from the existing `OpenAIAdapter`
3. Support z.ai-specific features: thinking mode, `do_sample`, `tool_stream`, web search, custom finish reasons (`sensitive`, `network_error`)
4. Keep `TLLMAdapterConfig` backwards-compatible via a generic `options` bag

## Non-Goals

- Replacing the Anthropic or Google adapters (they have non-OpenAI APIs)
- Adding z.ai's retrieval tool (knowledge base IDs are z.ai-specific, not portable)
- Supporting z.ai's multimodal inputs (images/video/files) in this iteration
- Adding z.ai's JWT authentication method (Bearer token is sufficient)

## Architecture

```
┌─────────────────────────────────────────────────────┐
│ repos/domain                                        │
│  ├── ELLMProvider: + zai                            │
│  ├── TLLMAdapterConfig: + options?: Record<...>     │
│  └── ProviderTemplates: + zai template              │
├─────────────────────────────────────────────────────┤
│ repos/agent/src/llm/                                │
│  ├── openai-compatible.ts  (NEW base class)         │
│  │     ├── fetch-based SSE streaming                │
│  │     ├── OpenAI message/tool format transforms    │
│  │     ├── Incremental tool call arg tracking       │
│  │     └── Overridable: URL, headers, body, finish  │
│  ├── openai.ts  (REFACTORED → extends base)        │
│  ├── zai.ts     (NEW → extends base)               │
│  ├── factory.ts (+ zai registration)               │
│  └── index.ts   (+ exports)                        │
├─────────────────────────────────────────────────────┤
│ repos/backend  (auto-propagates, no code changes)   │
│  └── resolveProviderType reads ELLMProvider enum    │
├─────────────────────────────────────────────────────┤
│ repos/admin  (auto-propagates, no code changes)     │
│  ├── ProviderDrawer renders from ELLMProvider       │
│  └── Quickstart renders from ProviderTemplates      │
└─────────────────────────────────────────────────────┘
```

## Detailed Design

### 1. TLLMAdapterConfig (Domain)

Add a single optional `options` field for provider-specific configuration:

```typescript
export type TLLMAdapterConfig = {
  model: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderType
  options?: Record<string, unknown>  // Provider-specific options
}
```

Each adapter type-narrows `options` internally. Callers pass `options: { thinking: true }` — no new types exported from domain. The `ILLMAdapter` interface is unchanged.

### 2. ELLMProvider Enum (Domain)

```typescript
export enum ELLMProvider {
  openai = 'openai',
  google = 'google',
  anthropic = 'anthropic',
  zai = 'zai',
}
```

This automatically propagates to:
- `TLLMProviderType` (derived union type)
- `resolveProviderType()` in backend (reads enum values)
- Admin ProviderDrawer dropdown (iterates enum values)

### 3. ProviderTemplates (Domain)

```typescript
zai: {
  id: 'zai',
  name: 'Z.AI',
  baseUrl: 'https://api.z.ai/api/paas/v4',
  defaultModel: 'glm-5',
  defaultSecretName: 'ZAI_API_KEY',
  apiKeyPlaceholder: 'Enter your Z.AI API key...',
  apiKeyPattern: '',
  models: [
    { id: 'glm-5', name: 'GLM-5', maxTokens: 131072, description: 'Most capable model' },
    { id: 'glm-4.7', name: 'GLM-4.7', maxTokens: 131072, description: 'High performance' },
    { id: 'glm-4.6', name: 'GLM-4.6', maxTokens: 131072, description: 'Supports tool streaming' },
    { id: 'glm-4.5', name: 'GLM-4.5', maxTokens: 131072, description: 'Efficient with thinking mode' },
  ],
}
```

This automatically populates the Quickstart wizard provider selection grid.

### 4. OpenAICompatibleAdapter Base Class (Agent)

**File**: `repos/agent/src/llm/openai-compatible.ts`

A `fetch`-based abstract class that handles the OpenAI chat completions protocol. Subclasses override only what differs.

```typescript
export abstract class OpenAICompatibleAdapter implements ILLMAdapter {
  abstract readonly provider: TLLMProviderType

  // --- Override points ---

  /** API base URL (e.g. 'https://api.openai.com/v1') */
  protected abstract getBaseUrl(config: TLLMAdapterConfig): string

  /** Auth and content-type headers. Default: Bearer token. */
  protected getHeaders(config: TLLMAdapterConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.apiKey}`,
    }
  }

  /** Provider-specific body fields merged into the request. Default: none. */
  protected getExtraBody(
    _config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    return {}
  }

  /** Map provider finish_reason to unified TStreamStopReason. */
  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case 'stop': return 'end_turn'
      case 'tool_calls': return 'tool_use'
      case 'length': return 'max_tokens'
      default: return 'end_turn'
    }
  }

  // --- Core implementation (shared) ---

  async *stream(
    messages: TAIMessage[],
    tools: TLLMToolDef[],
    config: TLLMAdapterConfig
  ): AsyncIterable<TStreamEvent> {
    const url = `${this.getBaseUrl(config)}/chat/completions`
    const headers = this.getHeaders(config)
    const extraBody = this.getExtraBody(config, tools)

    const body: Record<string, unknown> = {
      model: config.model,
      max_tokens: config.maxTokens ?? 4096,
      temperature: config.temperature,
      messages: toOpenAIMessages(messages),
      stream: true,
      ...extraBody,
    }

    if (tools.length > 0 && !extraBody.tools) {
      body.tools = toOpenAITools(tools)
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      yield { type: 'error', error: `${this.provider} API error ${res.status}: ${errText}` }
      yield { type: 'done', stopReason: 'error' }
      return
    }

    if (!res.body) {
      yield { type: 'error', error: 'No response body' }
      yield { type: 'done', stopReason: 'error' }
      return
    }

    // SSE parsing with incremental tool call tracking
    const toolCalls = new Map<number, { id: string; name: string; args: string }>()
    let buffer = ''
    const decoder = new TextDecoder()
    const reader = res.body.getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') return

        const chunk = JSON.parse(data)
        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        // Text content
        if (delta?.content) {
          yield { type: 'text', text: delta.content }
        }

        // Tool calls (streamed incrementally)
        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index
            if (tc.id) {
              toolCalls.set(idx, { id: tc.id, name: tc.function?.name || '', args: '' })
              yield { type: 'tool_call_start', id: tc.id, name: tc.function?.name || '' }
            }
            if (tc.function?.arguments) {
              const existing = toolCalls.get(idx)
              if (existing) {
                existing.args += tc.function.arguments
                yield { type: 'tool_call_args', id: existing.id, args: tc.function.arguments }
              }
            }
          }
        }

        // Finish reason
        if (choice.finish_reason) {
          yield { type: 'done', stopReason: this.mapFinishReason(choice.finish_reason) }
        }
      }
    }
  }
}
```

The `toOpenAIMessages()` and `toOpenAITools()` helper functions are extracted from the existing `openai.ts` unchanged and co-located in the base class file.

### 5. OpenAIAdapter Refactored (Agent)

Shrinks to ~10 lines:

```typescript
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  readonly provider = 'openai' as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return 'https://api.openai.com/v1'
  }
}
```

Default headers (Bearer), default finish reason mapping, default body — all inherited.

### 6. ZaiAdapter (Agent)

```typescript
type TZaiOptions = {
  thinking?: boolean
  thinkingBudget?: number
  doSample?: boolean
  toolStream?: boolean
  webSearch?: Record<string, unknown>
}

export class ZaiAdapter extends OpenAICompatibleAdapter {
  readonly provider = 'zai' as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return 'https://api.z.ai/api/paas/v4'
  }

  protected getExtraBody(
    config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    const opts = (config.options ?? {}) as TZaiOptions
    const extra: Record<string, unknown> = {}

    if (opts.thinking) {
      extra.thinking = {
        type: 'enabled',
        budget_tokens: opts.thinkingBudget ?? 2048,
      }
    }

    if (opts.doSample === false) {
      extra.do_sample = false
    }

    if (opts.toolStream) {
      extra.tool_stream = true
    }

    if (opts.webSearch) {
      extra.tools = [{
        type: 'web_search',
        web_search: { enable: true, ...opts.webSearch },
      }]
    }

    return extra
  }

  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case 'stop': return 'end_turn'
      case 'tool_calls': return 'tool_use'
      case 'length': return 'max_tokens'
      case 'sensitive': return 'error'
      case 'network_error': return 'error'
      default: return 'end_turn'
    }
  }
}
```

### 7. Factory Registration (Agent)

```typescript
const adapters = new Map<TLLMProviderType, () => ILLMAdapter>([
  ['anthropic', () => new AnthropicAdapter()],
  ['openai', () => new OpenAIAdapter()],
  ['google', () => new GoogleAdapter()],
  ['zai', () => new ZaiAdapter()],           // NEW
])
```

## File Changes

| # | File | Action | Est. Lines |
|---|------|--------|------------|
| 1 | `repos/domain/src/types/ai.types.ts` | Add `zai` to enum, `options` to config | ~5 |
| 2 | `repos/domain/src/constants/providers.ts` | Add z.ai provider template | ~20 |
| 3 | `repos/agent/src/llm/openai-compatible.ts` | **NEW** — base class | ~150 |
| 4 | `repos/agent/src/llm/openai.ts` | Refactor to extend base | ~10 (was 176) |
| 5 | `repos/agent/src/llm/zai.ts` | **NEW** — z.ai adapter | ~60 |
| 6 | `repos/agent/src/llm/factory.ts` | Add zai to map | ~3 |
| 7 | `repos/agent/src/llm/index.ts` | Export new modules | ~2 |
| 8 | `repos/agent/src/llm/openai-compatible.test.ts` | **NEW** — base class tests | ~200 |
| 9 | `repos/agent/src/llm/zai.test.ts` | **NEW** — z.ai adapter tests | ~150 |
| 10 | `repos/agent/src/llm/openai.test.ts` | Adjust for refactored adapter | ~adjust |
| 11 | `repos/agent/src/llm/factory.test.ts` | Add zai test case | ~10 |

**Auto-propagating** (zero code changes needed):
- `repos/backend/src/utils/providers/resolveProviderType.ts` — reads `ELLMProvider` enum
- `repos/admin/src/components/Providers/ProviderDrawer.tsx` — iterates `ELLMProvider`
- `repos/admin/src/components/Quickstart/ProviderStep.tsx` — iterates `ProviderTemplates`
- `repos/admin/src/components/Quickstart/ReviewStep.tsx` — reads `ProviderTemplates`

## Z.AI API Reference

- **Endpoint**: `POST https://api.z.ai/api/paas/v4/chat/completions`
- **Auth**: `Authorization: Bearer <API_KEY>`
- **Models**: glm-5, glm-4.7, glm-4.6, glm-4.5 (all 128K context)
- **Streaming**: SSE with `data:` prefix, `[DONE]` sentinel
- **Messages**: OpenAI-compatible (system/user/assistant/tool roles)
- **Tools**: OpenAI-compatible function calling format (max 128)
- **Finish reasons**: `stop`, `tool_calls`, `length`, `sensitive`, `network_error`
- **Unique features**:
  - `thinking`: Chain-of-thought mode (`{ type: "enabled", budget_tokens: N }`)
  - `do_sample`: Disable sampling (greedy decoding)
  - `tool_stream`: Stream tool call results (GLM-4.6 only)
  - `web_search`: Built-in web search tool
  - `response_format`: JSON mode (`{ type: "json_object" }`)

## Testing Strategy

1. **Base class tests** (`openai-compatible.test.ts`): Mock `fetch`, verify SSE parsing, message/tool transformation, incremental tool call arg tracking, finish reason mapping, error handling (non-OK response, missing body)
2. **ZaiAdapter tests** (`zai.test.ts`): Verify base URL, extra body fields for each option (thinking, doSample, toolStream, webSearch), custom finish reason mapping (sensitive → error, network_error → error)
3. **OpenAI regression tests** (`openai.test.ts`): Ensure all 17 existing tests pass with the refactored adapter extending the base class
4. **Factory tests** (`factory.test.ts`): Add zai provider creation, verify provider property

## Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| OpenAI adapter regression from refactor | Low | Existing 17 tests validate identical behavior |
| z.ai SSE format has undocumented quirks | Medium | Base class SSE parser is standard; ZaiAdapter can override stream() if needed |
| `openai` SDK removal breaks something | Low | No other code imports the SDK directly; factory is the only entry point |
| z.ai tool call streaming differs from OpenAI | Medium | `tool_stream` is GLM-4.6 only; test with actual API after implementation |
