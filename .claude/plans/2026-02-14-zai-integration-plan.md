# Z.AI Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add z.ai as a supported LLM provider with a reusable OpenAI-compatible base adapter class.

**Architecture:** Extract shared OpenAI-protocol logic (SSE parsing, message/tool transforms, tool call tracking) into an abstract `OpenAICompatibleAdapter` base class. Refactor `OpenAIAdapter` to extend it. Create `ZaiAdapter` extending the same base with z.ai-specific overrides. Add `zai` to domain enum and provider templates — admin UI and backend auto-propagate.

**Tech Stack:** TypeScript, Vitest, fetch API (no z.ai SDK needed)

**Design Doc:** `docs/plans/2026-02-14-zai-integration-design.md`

---

### Task 1: Domain — Add `zai` to ELLMProvider enum and `options` to TLLMAdapterConfig

**Files:**
- Modify: `repos/domain/src/types/ai.types.ts:68-72` (enum) and `:212-219` (config type)

**Step 1: Add `zai` to the ELLMProvider enum**

In `repos/domain/src/types/ai.types.ts`, change lines 68-72 from:

```typescript
export enum ELLMProvider {
  openai = `openai`,
  google = `google`,
  anthropic = `anthropic`,
}
```

to:

```typescript
export enum ELLMProvider {
  zai = `zai`,
  openai = `openai`,
  google = `google`,
  anthropic = `anthropic`,
}
```

**Step 2: Add `options` to TLLMAdapterConfig**

In the same file, change lines 212-219 from:

```typescript
export type TLLMAdapterConfig = {
  model: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderType
}
```

to:

```typescript
export type TLLMAdapterConfig = {
  model: string
  apiKey?: string
  maxTokens?: number
  temperature?: number
  systemPrompt?: string
  provider: TLLMProviderType
  options?: Record<string, unknown>
}
```

**Step 3: Build domain to verify no type errors**

Run: `pnpm --filter @tdsk/domain build`
Expected: Clean build, no errors.

**Step 4: Run domain tests**

Run: `pnpm --filter @tdsk/domain test`
Expected: All existing tests pass (303/303).

---

### Task 2: Domain — Add z.ai provider template

**Files:**
- Modify: `repos/domain/src/constants/providers.ts:91` (before `custom` entry)

**Step 1: Add z.ai template to ProviderTemplates**

In `repos/domain/src/constants/providers.ts`, add the z.ai entry before the `custom` entry (before line 91). The `custom` entry must remain last. Insert:

```typescript
  zai: {
    id: `zai`,
    name: `Z.AI`,
    baseUrl: `https://api.z.ai/api/paas/v4`,
    defaultModel: `glm-5`,
    defaultSecretName: `ZAI_API_KEY`,
    apiKeyPlaceholder: `Enter your Z.AI API key...`,
    apiKeyPattern: ``,
    models: [
      {
        id: `glm-5`,
        name: `GLM-5`,
        maxTokens: 131072,
        description: `Most capable model`,
      },
      {
        id: `glm-4.7`,
        name: `GLM-4.7`,
        maxTokens: 131072,
        description: `High performance`,
      },
      {
        id: `glm-4.6`,
        name: `GLM-4.6`,
        maxTokens: 131072,
        description: `Supports tool streaming`,
      },
      {
        id: `glm-4.5`,
        name: `GLM-4.5`,
        maxTokens: 131072,
        description: `Efficient with thinking mode`,
      },
    ],
  },
```

**Step 2: Build domain**

Run: `pnpm --filter @tdsk/domain build`
Expected: Clean build.

**Step 3: Commit domain changes**

```bash
git add repos/domain/src/types/ai.types.ts repos/domain/src/constants/providers.ts
git commit -m "feat(domain): add zai provider enum and template"
```

---

### Task 3: Agent — Create OpenAICompatibleAdapter base class

**Files:**
- Create: `repos/agent/src/llm/openai-compatible.ts`

**Step 1: Create the base class file**

Create `repos/agent/src/llm/openai-compatible.ts` with the following content. This extracts the `toOpenAIMessages()` and `toOpenAITools()` helpers from the current `openai.ts` and replaces the `openai` SDK with raw `fetch` + SSE parsing:

```typescript
import type {
  ILLMAdapter,
  TAIMessage,
  TLLMAdapterConfig,
  TLLMToolDef,
  TStreamEvent,
  TStreamStopReason,
} from '@tdsk/domain'

type TOpenAIMessage = {
  role: string
  content?: string | { type: string; text: string }[] | null
  tool_calls?: {
    id: string
    type: string
    function: { name: string; arguments: string }
  }[]
  tool_call_id?: string
}

type TOpenAITool = {
  type: string
  function: {
    name: string
    description: string
    parameters: TLLMToolDef[`inputSchema`]
  }
}

/**
 * Convert unified messages to OpenAI chat completions format
 */
export const toOpenAIMessages = (messages: TAIMessage[]): TOpenAIMessage[] => {
  const result: TOpenAIMessage[] = []

  for (const msg of messages) {
    if (msg.role === `system`) {
      const text = msg.content
        .filter((c) => c.type === `text`)
        .map((c) => c.text)
        .join(`\n`)
      result.push({ role: `system`, content: text })
      continue
    }

    if (msg.role === `user`) {
      const textParts = msg.content.filter((c) => c.type === `text`)
      const toolResults = msg.content.filter((c) => c.type === `tool_result`)

      if (textParts.length > 0) {
        const parts = textParts.map((c) => ({
          type: `text` as const,
          text: c.text,
        }))
        result.push({ role: `user`, content: parts })
      }

      for (const tr of toolResults) {
        result.push({
          role: `tool`,
          tool_call_id: tr.toolUseId,
          content: tr.content,
        })
      }
      continue
    }

    const textParts = msg.content.filter((c) => c.type === `text`)
    const toolParts = msg.content.filter((c) => c.type === `tool_use`)

    const assistantMsg: TOpenAIMessage = {
      role: `assistant`,
      content: textParts.map((c) => c.text).join(``) || null,
    }

    if (toolParts.length > 0) {
      assistantMsg.tool_calls = toolParts.map((c) => ({
        id: c.id,
        type: `function`,
        function: { name: c.name, arguments: JSON.stringify(c.input) },
      }))
    }

    result.push(assistantMsg)
  }

  return result
}

/**
 * Convert unified tool defs to OpenAI function calling format
 */
export const toOpenAITools = (tools: TLLMToolDef[]): TOpenAITool[] => {
  return tools.map((t) => ({
    type: `function`,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.inputSchema,
    },
  }))
}

/**
 * Abstract base class for OpenAI-compatible LLM providers.
 * Uses raw fetch + SSE parsing (no SDK dependency).
 * Subclasses override getBaseUrl, getHeaders, getExtraBody, mapFinishReason.
 */
export abstract class OpenAICompatibleAdapter implements ILLMAdapter {
  abstract readonly provider: string

  protected abstract getBaseUrl(config: TLLMAdapterConfig): string

  protected getHeaders(config: TLLMAdapterConfig): Record<string, string> {
    return {
      'Content-Type': `application/json`,
      Authorization: `Bearer ${config.apiKey}`,
    }
  }

  protected getExtraBody(
    _config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    return {}
  }

  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case `stop`:
        return `end_turn`
      case `tool_calls`:
        return `tool_use`
      case `length`:
        return `max_tokens`
      default:
        return `end_turn`
    }
  }

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
      method: `POST`,
      headers,
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const errText = await res.text()
      yield {
        type: `error` as const,
        error: `${this.provider} API error ${res.status}: ${errText}`,
      }
      yield { type: `done` as const, stopReason: `error` as const }
      return
    }

    if (!res.body) {
      yield { type: `error` as const, error: `No response body` }
      yield { type: `done` as const, stopReason: `error` as const }
      return
    }

    const toolCalls = new Map<
      number,
      { id: string; name: string; args: string }
    >()
    let buffer = ``
    const decoder = new TextDecoder()
    const reader = (res.body as ReadableStream<Uint8Array>).getReader()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split(`\n`)
      buffer = lines.pop() || ``

      for (const line of lines) {
        if (!line.startsWith(`data: `)) continue
        const data = line.slice(6).trim()
        if (data === `[DONE]`) return

        const chunk = JSON.parse(data)
        const choice = chunk.choices?.[0]
        if (!choice) continue

        const delta = choice.delta

        if (delta?.content) {
          yield { type: `text` as const, text: delta.content }
        }

        if (delta?.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index

            if (tc.id) {
              toolCalls.set(idx, {
                id: tc.id,
                name: tc.function?.name || ``,
                args: ``,
              })
              yield {
                type: `tool_call_start` as const,
                id: tc.id,
                name: tc.function?.name || ``,
              }
            }

            if (tc.function?.arguments) {
              const existing = toolCalls.get(idx)
              if (existing) {
                existing.args += tc.function.arguments
                yield {
                  type: `tool_call_args` as const,
                  id: existing.id,
                  args: tc.function.arguments,
                }
              }
            }
          }
        }

        if (choice.finish_reason) {
          yield {
            type: `done` as const,
            stopReason: this.mapFinishReason(choice.finish_reason),
          }
        }
      }
    }
  }
}
```

**Step 2: Export from index**

In `repos/agent/src/llm/index.ts`, add at the top:

```typescript
export * from './openai-compatible'
```

**Step 3: Build agent to verify no compilation errors**

Run: `pnpm --filter @tdsk/agent build:app`
Expected: Clean build.

---

### Task 4: Agent — Create OpenAICompatibleAdapter tests

**Files:**
- Create: `repos/agent/src/llm/openai-compatible.test.ts`

**Step 1: Write the base class test file**

Create `repos/agent/src/llm/openai-compatible.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TLLMAdapterConfig, TAIMessage, TLLMToolDef } from '@tdsk/domain'
import {
  OpenAICompatibleAdapter,
  toOpenAIMessages,
  toOpenAITools,
} from './openai-compatible'

/**
 * Concrete test subclass — minimal overrides
 */
class TestAdapter extends OpenAICompatibleAdapter {
  readonly provider = `test-provider` as any

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.test.com/v1`
  }
}

const baseConfig: TLLMAdapterConfig = {
  apiKey: `test-key`,
  model: `test-model`,
  provider: `openai` as const,
  temperature: 0.7,
}

const baseMessages: TAIMessage[] = [
  { role: `user`, content: [{ type: `text`, text: `Hello` }] },
]

/**
 * Helper to create a mock fetch Response with SSE body
 */
const createSSEResponse = (events: string[], status = 200): Response => {
  const body = events.join(`\n`) + `\n`
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })

  return new Response(stream, {
    status,
    statusText: status === 200 ? `OK` : `Error`,
    headers: { 'Content-Type': `text/event-stream` },
  })
}

/**
 * Helper to collect all events from the adapter stream
 */
const collectEvents = async (stream: AsyncIterable<unknown>) => {
  const events: unknown[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe(`toOpenAIMessages`, () => {
  it(`should convert system messages`, () => {
    const messages: TAIMessage[] = [
      { role: `system`, content: [{ type: `text`, text: `You are helpful` }] },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([{ role: `system`, content: `You are helpful` }])
  })

  it(`should convert user text messages`, () => {
    const messages: TAIMessage[] = [
      { role: `user`, content: [{ type: `text`, text: `Hi` }] },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([
      { role: `user`, content: [{ type: `text`, text: `Hi` }] },
    ])
  })

  it(`should convert user messages with tool results to separate tool messages`, () => {
    const messages: TAIMessage[] = [
      {
        role: `user`,
        content: [
          {
            type: `tool_result`,
            toolUseId: `call_123`,
            content: `result data`,
          },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([
      { role: `tool`, tool_call_id: `call_123`, content: `result data` },
    ])
  })

  it(`should convert assistant messages with tool calls`, () => {
    const messages: TAIMessage[] = [
      {
        role: `assistant`,
        content: [
          {
            type: `tool_use`,
            id: `call_abc`,
            name: `get_weather`,
            input: { city: `NYC` },
          },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([
      {
        role: `assistant`,
        content: null,
        tool_calls: [
          {
            id: `call_abc`,
            type: `function`,
            function: {
              name: `get_weather`,
              arguments: `{"city":"NYC"}`,
            },
          },
        ],
      },
    ])
  })

  it(`should join multiple system text parts with newline`, () => {
    const messages: TAIMessage[] = [
      {
        role: `system`,
        content: [
          { type: `text`, text: `Line 1` },
          { type: `text`, text: `Line 2` },
        ],
      },
    ]
    const result = toOpenAIMessages(messages)
    expect(result).toEqual([{ role: `system`, content: `Line 1\nLine 2` }])
  })
})

describe(`toOpenAITools`, () => {
  it(`should convert tool defs to OpenAI function format`, () => {
    const tools: TLLMToolDef[] = [
      {
        name: `search`,
        description: `Search the web`,
        inputSchema: {
          type: `object`,
          properties: {
            query: { type: `string`, description: `Search query` },
          },
          required: [`query`],
        },
      },
    ]
    const result = toOpenAITools(tools)
    expect(result).toEqual([
      {
        type: `function`,
        function: {
          name: `search`,
          description: `Search the web`,
          parameters: tools[0].inputSchema,
        },
      },
    ])
  })
})

describe(`OpenAICompatibleAdapter`, () => {
  let adapter: TestAdapter

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new TestAdapter()
  })

  it(`should have the provider property from the subclass`, () => {
    expect(adapter.provider).toBe(`test-provider`)
  })

  describe(`stream`, () => {
    it(`should yield text events for SSE chunks with delta.content`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hello` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: ` world` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hello` },
        { type: `text`, text: ` world` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield tool_call_start and tool_call_args events`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: `call_abc`,
                function: { name: `get_weather`, arguments: `` },
              }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                function: { arguments: `{"city":"NYC"}` },
              }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_abc`, name: `get_weather` },
        { type: `tool_call_args`, id: `call_abc`, args: `{"city":"NYC"}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should handle multiple concurrent tool calls`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, id: `call_1`, function: { name: `tool_a`, arguments: `` } },
                { index: 1, id: `call_2`, function: { name: `tool_b`, arguments: `` } },
              ],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: `{"a":1}` } },
                { index: 1, function: { arguments: `{"b":2}` } },
              ],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_1`, name: `tool_a` },
        { type: `tool_call_start`, id: `call_2`, name: `tool_b` },
        { type: `tool_call_args`, id: `call_1`, args: `{"a":1}` },
        { type: `tool_call_args`, id: `call_2`, args: `{"b":2}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should skip SSE lines that are not data lines`, async () => {
      const sseEvents = [
        `: this is a comment`,
        `event: message`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hi` }, finish_reason: null }] })}`,
        ``,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should skip chunks with no choices`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hi` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield error event for non-OK response`, async () => {
      const res = new Response(`Unauthorized`, { status: 401, statusText: `Unauthorized` })
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(res)

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `error`, error: `test-provider API error 401: Unauthorized` },
        { type: `done`, stopReason: `error` },
      ])
    })

    it(`should yield error event when response has no body`, async () => {
      const res = new Response(null, { status: 200 })
      Object.defineProperty(res, `body`, { value: null })
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(res)

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `error`, error: `No response body` },
        { type: `done`, stopReason: `error` },
      ])
    })

    describe(`finish_reason mapping`, () => {
      const testFinishReason = async (reason: string, expected: string) => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))
        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: expected }])
      }

      it(`should map 'stop' to 'end_turn'`, () => testFinishReason(`stop`, `end_turn`))
      it(`should map 'tool_calls' to 'tool_use'`, () => testFinishReason(`tool_calls`, `tool_use`))
      it(`should map 'length' to 'max_tokens'`, () => testFinishReason(`length`, `max_tokens`))
      it(`should map unknown to 'end_turn'`, () => testFinishReason(`content_filter`, `end_turn`))
    })

    describe(`request construction`, () => {
      it(`should POST to baseUrl/chat/completions`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(fetchSpy).toHaveBeenCalledWith(
          `https://api.test.com/v1/chat/completions`,
          expect.any(Object)
        )
      })

      it(`should send Authorization Bearer header`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)[`Authorization`]).toBe(
          `Bearer test-key`
        )
      })

      it(`should include model, max_tokens, temperature, stream in body`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.model).toBe(`test-model`)
        expect(body.max_tokens).toBe(4096)
        expect(body.temperature).toBe(0.7)
        expect(body.stream).toBe(true)
      })

      it(`should use provided maxTokens when specified`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(
          adapter.stream(baseMessages, [], { ...baseConfig, maxTokens: 2048 })
        )

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.max_tokens).toBe(2048)
      })

      it(`should include tools when tools array is non-empty`, async () => {
        const tools: TLLMToolDef[] = [
          {
            name: `search`,
            description: `Search`,
            inputSchema: {
              type: `object`,
              properties: { q: { type: `string` } },
            },
          },
        ]
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, tools, baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toEqual([
          {
            type: `function`,
            function: {
              name: `search`,
              description: `Search`,
              parameters: tools[0].inputSchema,
            },
          },
        ])
      })

      it(`should not include tools when tools array is empty`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toBeUndefined()
      })
    })
  })
})
```

**Step 2: Run the tests**

Run: `pnpm --filter @tdsk/agent test -- src/llm/openai-compatible.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add repos/agent/src/llm/openai-compatible.ts repos/agent/src/llm/openai-compatible.test.ts repos/agent/src/llm/index.ts
git commit -m "feat(agent): add OpenAICompatibleAdapter base class with tests"
```

---

### Task 5: Agent — Refactor OpenAIAdapter to extend base class

**Files:**
- Modify: `repos/agent/src/llm/openai.ts` (replace entire contents)
- Modify: `repos/agent/src/llm/openai.test.ts` (adapt for fetch-based adapter)

**Step 1: Replace openai.ts with the subclass**

Replace the entire contents of `repos/agent/src/llm/openai.ts` with:

```typescript
import type { TLLMAdapterConfig } from '@tdsk/domain'
import { OpenAICompatibleAdapter } from './openai-compatible'

/**
 * OpenAI LLM adapter — extends OpenAICompatibleAdapter
 * Uses default Bearer auth, default finish reason mapping
 */
export class OpenAIAdapter extends OpenAICompatibleAdapter {
  readonly provider = `openai` as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.openai.com/v1`
  }
}
```

**Step 2: Rewrite the OpenAI tests for fetch-based adapter**

Replace the entire contents of `repos/agent/src/llm/openai.test.ts` with:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { OpenAIAdapter } from '@TAG/llm/openai'

/**
 * Helper to create a mock fetch Response with SSE body
 */
const createSSEResponse = (events: string[], status = 200): Response => {
  const body = events.join(`\n`) + `\n`
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })

  return new Response(stream, {
    status,
    statusText: status === 200 ? `OK` : `Error`,
    headers: { 'Content-Type': `text/event-stream` },
  })
}

/**
 * Helper to collect all events from the adapter stream
 */
const collectEvents = async (stream: AsyncIterable<unknown>) => {
  const events: unknown[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe(`OpenAIAdapter`, () => {
  let adapter: OpenAIAdapter

  const baseConfig = {
    apiKey: `test-api-key`,
    model: `gpt-4`,
    provider: `openai` as const,
    temperature: 0.7,
  }

  const baseMessages = [
    {
      role: `user` as const,
      content: [{ type: `text` as const, text: `Hello` }],
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new OpenAIAdapter()
  })

  it(`should have provider set to 'openai'`, () => {
    expect(adapter.provider).toBe(`openai`)
  })

  describe(`stream`, () => {
    it(`should yield text events for chunks with delta.content`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hello` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: ` world` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hello` },
        { type: `text`, text: ` world` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    it(`should yield tool_call_start and tool_call_args events for tool calls`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{
                index: 0,
                id: `call_abc123`,
                function: { name: `get_weather`, arguments: `` },
              }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{ index: 0, function: { arguments: `{"location":` } }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{ index: 0, function: { arguments: `"NYC"}` } }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_abc123`, name: `get_weather` },
        { type: `tool_call_args`, id: `call_abc123`, args: `{"location":` },
        { type: `tool_call_args`, id: `call_abc123`, args: `"NYC"}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should handle multiple concurrent tool calls`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, id: `call_1`, function: { name: `tool_a`, arguments: `` } },
                { index: 1, id: `call_2`, function: { name: `tool_b`, arguments: `` } },
              ],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: `{"a":1}` } },
                { index: 1, function: { arguments: `{"b":2}` } },
              ],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `tool_call_start`, id: `call_1`, name: `tool_a` },
        { type: `tool_call_start`, id: `call_2`, name: `tool_b` },
        { type: `tool_call_args`, id: `call_1`, args: `{"a":1}` },
        { type: `tool_call_args`, id: `call_2`, args: `{"b":2}` },
        { type: `done`, stopReason: `tool_use` },
      ])
    })

    it(`should skip chunks with no choices`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: { content: `Hi` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `Hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })

    describe(`finish_reason mapping`, () => {
      it(`should map 'stop' to 'end_turn'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })

      it(`should map 'tool_calls' to 'tool_use'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `tool_use` }])
      })

      it(`should map 'length' to 'max_tokens'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `length` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `max_tokens` }])
      })

      it(`should map unknown finish_reason to 'end_turn'`, async () => {
        const sseEvents = [
          `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `content_filter` }] })}`,
          `data: [DONE]`,
        ]
        vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

        const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
        expect(events).toEqual([{ type: `done`, stopReason: `end_turn` }])
      })
    })

    describe(`params construction`, () => {
      it(`should POST to OpenAI chat completions URL`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        expect(fetchSpy).toHaveBeenCalledWith(
          `https://api.openai.com/v1/chat/completions`,
          expect.any(Object)
        )
      })

      it(`should include tools in params when tools array is non-empty`, async () => {
        const tools = [
          {
            name: `get_weather`,
            description: `Get weather for a location`,
            inputSchema: {
              type: `object` as const,
              properties: {
                location: { type: `string`, description: `City name` },
              },
              required: [`location`],
            },
          },
        ]
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, tools, baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toEqual([
          {
            type: `function`,
            function: {
              name: `get_weather`,
              description: `Get weather for a location`,
              parameters: tools[0].inputSchema,
            },
          },
        ])
      })

      it(`should not include tools in params when tools array is empty`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.tools).toBeUndefined()
      })

      it(`should use default maxTokens of 4096 when not specified`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )
        const configNoMax = { apiKey: `k`, model: `m`, provider: `openai` as const, temperature: 0.5 }

        await collectEvents(adapter.stream(baseMessages, [], configNoMax))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.max_tokens).toBe(4096)
      })

      it(`should use provided maxTokens when specified`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(
          adapter.stream(baseMessages, [], { ...baseConfig, maxTokens: 2048 })
        )

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.max_tokens).toBe(2048)
      })

      it(`should pass model, temperature, and stream:true in params`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
        expect(body.model).toBe(`gpt-4`)
        expect(body.temperature).toBe(0.7)
        expect(body.stream).toBe(true)
      })

      it(`should send Bearer token in Authorization header`, async () => {
        const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
          createSSEResponse([`data: [DONE]`])
        )

        await collectEvents(adapter.stream(baseMessages, [], baseConfig))

        const callArgs = fetchSpy.mock.calls[0][1] as RequestInit
        expect((callArgs.headers as Record<string, string>)[`Authorization`]).toBe(
          `Bearer test-api-key`
        )
      })
    })

    it(`should yield tool_call_start with empty name when function name is missing`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: { tool_calls: [{ index: 0, id: `call_no_name`, function: {} }] },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events[0]).toEqual({
        type: `tool_call_start`,
        id: `call_no_name`,
        name: ``,
      })
    })

    it(`should accumulate tool call arguments across multiple chunks`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({
          choices: [{
            delta: {
              tool_calls: [{ index: 0, id: `call_accum`, function: { name: `search`, arguments: `{` } }],
            },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: { tool_calls: [{ index: 0, function: { arguments: `"query"` } }] },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({
          choices: [{
            delta: { tool_calls: [{ index: 0, function: { arguments: `:"test"}` } }] },
            finish_reason: null,
          }],
        })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `tool_calls` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events[0]).toEqual({ type: `tool_call_start`, id: `call_accum`, name: `search` })
      expect(events[1]).toEqual({ type: `tool_call_args`, id: `call_accum`, args: `{` })
      expect(events[2]).toEqual({ type: `tool_call_args`, id: `call_accum`, args: `"query"` })
      expect(events[3]).toEqual({ type: `tool_call_args`, id: `call_accum`, args: `:"test"}` })
    })
  })
})
```

**Step 3: Run OpenAI tests**

Run: `pnpm --filter @tdsk/agent test -- src/llm/openai.test.ts`
Expected: All 17 tests pass (same test coverage, adapted for fetch-based implementation).

**Step 4: Commit**

```bash
git add repos/agent/src/llm/openai.ts repos/agent/src/llm/openai.test.ts
git commit -m "refactor(agent): OpenAIAdapter extends OpenAICompatibleAdapter base class"
```

---

### Task 6: Agent — Create ZaiAdapter

**Files:**
- Create: `repos/agent/src/llm/zai.ts`

**Step 1: Create the ZaiAdapter file**

Create `repos/agent/src/llm/zai.ts`:

```typescript
import type { TLLMAdapterConfig, TLLMToolDef, TStreamStopReason } from '@tdsk/domain'
import { OpenAICompatibleAdapter } from './openai-compatible'

type TZaiOptions = {
  thinking?: boolean
  thinkingBudget?: number
  doSample?: boolean
  toolStream?: boolean
  webSearch?: Record<string, unknown>
}

/**
 * Z.AI LLM adapter for GLM models
 * Extends OpenAI-compatible base with z.ai-specific features:
 * - thinking mode (chain-of-thought)
 * - do_sample control (greedy decoding)
 * - tool_stream (GLM-4.6 only)
 * - built-in web_search tool
 * - custom finish reasons (sensitive, network_error)
 */
export class ZaiAdapter extends OpenAICompatibleAdapter {
  readonly provider = `zai` as const

  protected getBaseUrl(_config: TLLMAdapterConfig): string {
    return `https://api.z.ai/api/paas/v4`
  }

  protected getExtraBody(
    config: TLLMAdapterConfig,
    _tools: TLLMToolDef[]
  ): Record<string, unknown> {
    const opts = (config.options ?? {}) as TZaiOptions
    const extra: Record<string, unknown> = {}

    if (opts.thinking) {
      extra.thinking = {
        type: `enabled`,
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
      extra.tools = [
        {
          type: `web_search`,
          web_search: { enable: true, ...opts.webSearch },
        },
      ]
    }

    return extra
  }

  protected mapFinishReason(reason: string): TStreamStopReason {
    switch (reason) {
      case `stop`:
        return `end_turn`
      case `tool_calls`:
        return `tool_use`
      case `length`:
        return `max_tokens`
      case `sensitive`:
        return `error`
      case `network_error`:
        return `error`
      default:
        return `end_turn`
    }
  }
}
```

**Step 2: Export from index**

In `repos/agent/src/llm/index.ts`, add:

```typescript
export * from './zai'
```

**Step 3: Build agent to verify compilation**

Run: `pnpm --filter @tdsk/agent build:app`
Expected: Clean build.

---

### Task 7: Agent — Create ZaiAdapter tests

**Files:**
- Create: `repos/agent/src/llm/zai.test.ts`

**Step 1: Write the ZaiAdapter test file**

Create `repos/agent/src/llm/zai.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TLLMAdapterConfig } from '@tdsk/domain'
import { ZaiAdapter } from './zai'

const createSSEResponse = (events: string[], status = 200): Response => {
  const body = events.join(`\n`) + `\n`
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(body))
      controller.close()
    },
  })

  return new Response(stream, {
    status,
    statusText: status === 200 ? `OK` : `Error`,
    headers: { 'Content-Type': `text/event-stream` },
  })
}

const collectEvents = async (stream: AsyncIterable<unknown>) => {
  const events: unknown[] = []
  for await (const event of stream) {
    events.push(event)
  }
  return events
}

describe(`ZaiAdapter`, () => {
  let adapter: ZaiAdapter

  const baseConfig: TLLMAdapterConfig = {
    apiKey: `zai-test-key`,
    model: `glm-5`,
    provider: `zai` as any,
    temperature: 0.7,
  }

  const baseMessages = [
    {
      role: `user` as const,
      content: [{ type: `text` as const, text: `Hello` }],
    },
  ]

  beforeEach(() => {
    vi.restoreAllMocks()
    adapter = new ZaiAdapter()
  })

  it(`should have provider set to 'zai'`, () => {
    expect(adapter.provider).toBe(`zai`)
  })

  describe(`getBaseUrl`, () => {
    it(`should POST to z.ai API endpoint`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )

      await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(fetchSpy).toHaveBeenCalledWith(
        `https://api.z.ai/api/paas/v4/chat/completions`,
        expect.any(Object)
      )
    })
  })

  describe(`getExtraBody`, () => {
    it(`should not add extra fields when options is empty`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )

      await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toBeUndefined()
      expect(body.do_sample).toBeUndefined()
      expect(body.tool_stream).toBeUndefined()
    })

    it(`should add thinking mode when options.thinking is true`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = { ...baseConfig, options: { thinking: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 2048 })
    })

    it(`should use custom thinkingBudget when provided`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = {
        ...baseConfig,
        options: { thinking: true, thinkingBudget: 4096 },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 4096 })
    })

    it(`should add do_sample:false when options.doSample is false`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = { ...baseConfig, options: { doSample: false } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.do_sample).toBe(false)
    })

    it(`should not add do_sample when doSample is not explicitly false`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = { ...baseConfig, options: { doSample: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.do_sample).toBeUndefined()
    })

    it(`should add tool_stream:true when options.toolStream is true`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = { ...baseConfig, options: { toolStream: true } }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.tool_stream).toBe(true)
    })

    it(`should add web_search tool when options.webSearch is provided`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = {
        ...baseConfig,
        options: { webSearch: { search_engine: `search_pro_jina` } },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.tools).toEqual([
        {
          type: `web_search`,
          web_search: { enable: true, search_engine: `search_pro_jina` },
        },
      ])
    })

    it(`should combine multiple options`, async () => {
      const fetchSpy = vi.spyOn(globalThis, `fetch`).mockResolvedValue(
        createSSEResponse([`data: [DONE]`])
      )
      const config = {
        ...baseConfig,
        options: { thinking: true, doSample: false, toolStream: true },
      }

      await collectEvents(adapter.stream(baseMessages, [], config))

      const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string)
      expect(body.thinking).toEqual({ type: `enabled`, budget_tokens: 2048 })
      expect(body.do_sample).toBe(false)
      expect(body.tool_stream).toBe(true)
    })
  })

  describe(`mapFinishReason`, () => {
    const testFinishReason = async (reason: string, expected: string) => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: reason }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))
      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))
      expect(events).toEqual([{ type: `done`, stopReason: expected }])
    }

    it(`should map 'stop' to 'end_turn'`, () => testFinishReason(`stop`, `end_turn`))
    it(`should map 'tool_calls' to 'tool_use'`, () => testFinishReason(`tool_calls`, `tool_use`))
    it(`should map 'length' to 'max_tokens'`, () => testFinishReason(`length`, `max_tokens`))
    it(`should map 'sensitive' to 'error'`, () => testFinishReason(`sensitive`, `error`))
    it(`should map 'network_error' to 'error'`, () => testFinishReason(`network_error`, `error`))
    it(`should map unknown to 'end_turn'`, () => testFinishReason(`something_else`, `end_turn`))
  })

  describe(`streaming`, () => {
    it(`should stream text from z.ai SSE response`, async () => {
      const sseEvents = [
        `data: ${JSON.stringify({ choices: [{ delta: { content: `GLM says hi` }, finish_reason: null }] })}`,
        `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: `stop` }] })}`,
        `data: [DONE]`,
      ]
      vi.spyOn(globalThis, `fetch`).mockResolvedValue(createSSEResponse(sseEvents))

      const events = await collectEvents(adapter.stream(baseMessages, [], baseConfig))

      expect(events).toEqual([
        { type: `text`, text: `GLM says hi` },
        { type: `done`, stopReason: `end_turn` },
      ])
    })
  })
})
```

**Step 2: Run the ZaiAdapter tests**

Run: `pnpm --filter @tdsk/agent test -- src/llm/zai.test.ts`
Expected: All tests pass.

**Step 3: Commit**

```bash
git add repos/agent/src/llm/zai.ts repos/agent/src/llm/zai.test.ts repos/agent/src/llm/index.ts
git commit -m "feat(agent): add ZaiAdapter for z.ai GLM models"
```

---

### Task 8: Agent — Register ZaiAdapter in factory

**Files:**
- Modify: `repos/agent/src/llm/factory.ts:1-11`
- Modify: `repos/agent/src/llm/factory.test.ts`

**Step 1: Add ZaiAdapter import and registration**

In `repos/agent/src/llm/factory.ts`, add the import for ZaiAdapter and register it in the Map.

Change lines 1-11 from:

```typescript
import type { ILLMAdapter, TLLMProviderType } from '@tdsk/domain'

import { AnthropicAdapter } from './anthropic'
import { OpenAIAdapter } from './openai'
import { GoogleAdapter } from './google'

const adapters = new Map<TLLMProviderType, () => ILLMAdapter>([
  [`anthropic`, () => new AnthropicAdapter()],
  [`openai`, () => new OpenAIAdapter()],
  [`google`, () => new GoogleAdapter()],
])
```

to:

```typescript
import type { ILLMAdapter, TLLMProviderType } from '@tdsk/domain'

import { ZaiAdapter } from './zai'
import { AnthropicAdapter } from './anthropic'
import { OpenAIAdapter } from './openai'
import { GoogleAdapter } from './google'

const adapters = new Map<TLLMProviderType, () => ILLMAdapter>([
  [`zai`, () => new ZaiAdapter()],
  [`anthropic`, () => new AnthropicAdapter()],
  [`openai`, () => new OpenAIAdapter()],
  [`google`, () => new GoogleAdapter()],
])
```

**Step 2: Add ZaiAdapter test to factory tests**

In `repos/agent/src/llm/factory.test.ts`, add the mock for ZaiAdapter and the test case.

Add after line 26 (after the Google mock):

```typescript
vi.mock(`@TAG/llm/zai`, () => ({
  ZaiAdapter: vi.fn().mockImplementation(function (this: any) {
    this.provider = `zai`
    this.stream = vi.fn()
  }),
}))
```

Add the import at the top (after line 4):

```typescript
import { ZaiAdapter } from './zai'
```

Add the test case after the Google test (after line 45):

```typescript
  it(`should create a ZaiAdapter for 'zai'`, () => {
    const adapter = createLLMAdapter(`zai`)
    expect(adapter).toBeInstanceOf(ZaiAdapter)
    expect(adapter.provider).toBe(`zai`)
  })
```

Update the ILLMAdapter test (line 60) to include `zai`:

```typescript
    for (const provider of [`anthropic`, `openai`, `google`, `zai`] as const) {
```

**Step 3: Run factory tests**

Run: `pnpm --filter @tdsk/agent test -- src/llm/factory.test.ts`
Expected: All tests pass (was 6, now 7).

**Step 4: Commit**

```bash
git add repos/agent/src/llm/factory.ts repos/agent/src/llm/factory.test.ts
git commit -m "feat(agent): register ZaiAdapter in LLM factory"
```

---

### Task 9: Full test suite + build validation

**Files:** None (validation only)

**Step 1: Run all agent tests**

Run: `pnpm --filter @tdsk/agent test`
Expected: All tests pass (was 150, now ~180+ with new tests).

**Step 2: Build domain**

Run: `pnpm --filter @tdsk/domain build`
Expected: Clean build.

**Step 3: Build agent**

Run: `pnpm --filter @tdsk/agent build:app`
Expected: Clean build.

**Step 4: Run domain tests**

Run: `pnpm --filter @tdsk/domain test`
Expected: All 303 tests pass.

**Step 5: Run backend tests (verify no regressions)**

Run: `pnpm --filter @tdsk/backend test`
Expected: All 584+ tests pass (domain type changes are backward-compatible).

**Step 6: Final commit (if any uncommitted changes remain)**

```bash
git add -A
git commit -m "feat: z.ai integration with OpenAI-compatible base adapter"
```
