import { describe, it, expect, vi } from 'vitest'
import type { TTokenUsage } from '@tdsk/domain'
import { EStreamEventType, EStreamStopReason } from '@tdsk/domain'
import {
  createStreamingAdapter,
  createNonStreamingAdapter,
  formatOAIError,
} from './responseAdapter'
import { Exception } from '@tdsk/domain'

const mockUsage = (input: number, output: number): TTokenUsage => ({
  input,
  output,
  cacheRead: 0,
  cacheWrite: 0,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
})

const createMockRes = () => {
  const chunks: string[] = []
  return {
    write: vi.fn((data: string) => chunks.push(data)),
    end: vi.fn(),
    _chunks: chunks,
  } as any
}

describe(`createStreamingAdapter`, () => {
  it(`should send initial chunk with assistant role`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.sendInitial()

    const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(chunk.choices[0].delta.role).toBe(`assistant`)
    expect(chunk.object).toBe(`chat.completion.chunk`)
  })

  it(`should forward text events as content delta`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({ type: EStreamEventType.text, text: `Hello` })

    const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(chunk.choices[0].delta.content).toBe(`Hello`)
  })

  it(`should map done event to finish_reason`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.endTurn,
    })

    const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(chunk.choices[0].finish_reason).toBe(`stop`)
  })

  it(`should map toolUse stop reason to tool_calls (streaming)`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.toolUse,
    })

    const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(chunk.choices[0].finish_reason).toBe(`tool_calls`)
  })

  it(`should map turnEnd event to usage`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.turnEnd,
      usage: mockUsage(10, 20),
    })

    const chunk = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(chunk.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 20,
      total_tokens: 30,
    })
  })

  it(`should forward error events as error data lines`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({ type: EStreamEventType.error, error: `LLM timeout` })

    const errorLine = JSON.parse(res._chunks[0].replace(`data: `, ``))
    expect(errorLine.error.message).toBe(`LLM timeout`)
    expect(errorLine.error.type).toBe(`server_error`)
  })

  it(`should silently drop thinking events`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({ type: EStreamEventType.thinking, thinking: `hmm` })
    expect(res.write).not.toHaveBeenCalled()
  })

  it(`should silently drop toolCallStart events`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.toolCallStart,
      id: `call-1`,
      name: `search`,
    })
    expect(res.write).not.toHaveBeenCalled()
  })

  it(`should silently drop toolResult events`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.toolResult,
      toolUseId: `call-1`,
      content: `result data`,
    })
    expect(res.write).not.toHaveBeenCalled()
  })

  it(`should send DONE sentinel on finish`, () => {
    const res = createMockRes()
    const adapter = createStreamingAdapter(res, `chatcmpl-1`, `test-model`)
    adapter.finish()

    expect(res._chunks[0]).toBe(`data: [DONE]\n\n`)
    expect(res.end).toHaveBeenCalled()
  })
})

describe(`createNonStreamingAdapter`, () => {
  it(`should accumulate text and build response`, () => {
    const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
    adapter.onEvent({ type: EStreamEventType.text, text: `Hello ` })
    adapter.onEvent({ type: EStreamEventType.text, text: `world` })
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.endTurn,
    })
    adapter.onEvent({
      type: EStreamEventType.turnEnd,
      usage: mockUsage(5, 10),
    })

    const result = adapter.build()
    expect(result.object).toBe(`chat.completion`)
    expect(result.choices[0].message.content).toBe(`Hello world`)
    expect(result.choices[0].finish_reason).toBe(`stop`)
    expect(result.usage.total_tokens).toBe(15)
  })

  it(`should return null content when no text events received`, () => {
    const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.endTurn,
    })
    const result = adapter.build()
    expect(result.choices[0].message.content).toBeNull()
  })

  it(`should capture error events and throw on build`, () => {
    const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
    adapter.onEvent({ type: EStreamEventType.text, text: `partial` })
    adapter.onEvent({ type: EStreamEventType.error, error: `Provider rate limit` })

    expect(() => adapter.build()).toThrow(`Provider rate limit`)
  })

  it(`should map maxTokens stop reason to length`, () => {
    const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.maxTokens,
    })
    const result = adapter.build()
    expect(result.choices[0].finish_reason).toBe(`length`)
  })

  it(`should map toolUse stop reason to tool_calls`, () => {
    const adapter = createNonStreamingAdapter(`chatcmpl-1`, `test-model`)
    adapter.onEvent({
      type: EStreamEventType.done,
      stopReason: EStreamStopReason.toolUse,
    })
    const result = adapter.build()
    expect(result.choices[0].finish_reason).toBe(`tool_calls`)
  })
})

describe(`formatOAIError`, () => {
  it(`should map Exception status to error type`, () => {
    expect(formatOAIError(new Exception(401, `bad`)).body.error.type).toBe(
      `authentication_error`
    )
    expect(formatOAIError(new Exception(403, `bad`)).body.error.type).toBe(
      `authentication_error`
    )
    expect(formatOAIError(new Exception(429, `bad`)).body.error.type).toBe(
      `rate_limit_error`
    )
    expect(formatOAIError(new Exception(400, `bad`)).body.error.type).toBe(
      `invalid_request_error`
    )
    expect(formatOAIError(new Exception(500, `bad`)).body.error.type).toBe(`server_error`)
  })

  it(`should use 500 for non-Exception errors`, () => {
    const { status } = formatOAIError(new Error(`oops`))
    expect(status).toBe(500)
  })

  it(`should use string value as message for string errors`, () => {
    const { body } = formatOAIError(`string error`)
    expect(body.error.message).toBe(`string error`)
  })

  it(`should use generic message for non-string non-Error values`, () => {
    const { body } = formatOAIError(42)
    expect(body.error.message).toBe(`Internal server error`)
  })

  it(`should use generic message for null`, () => {
    const { body } = formatOAIError(null)
    expect(body.error.message).toBe(`Internal server error`)
  })
})
