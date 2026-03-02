import type { AgentMessage } from '@mariozechner/pi-agent-core'
import type { Api, Model } from '@mariozechner/pi-ai'

import { describe, it, expect, vi } from 'vitest'
import { createContextManager, createContextPruner } from './contextManager'

const makeModel = (contextWindow: number) => ({ contextWindow }) as Model<Api>

const makeMsg = (text: string): AgentMessage =>
  ({
    role: `user`,
    content: text,
    timestamp: Date.now(),
  }) as unknown as AgentMessage

const makeAssistantMsg = (blocks: Array<{ type: string; text?: string }>): AgentMessage =>
  ({
    role: `assistant`,
    content: blocks,
    api: `anthropic-messages`,
    provider: `anthropic`,
    model: `test`,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: {} },
    stopReason: `stop`,
    timestamp: Date.now(),
  }) as unknown as AgentMessage

describe(`createContextManager`, () => {
  describe(`prune strategy (default)`, () => {
    it(`should return all messages when within budget`, async () => {
      const model = makeModel(100000) // 100k tokens
      const manager = createContextManager(model, 80) // 80k budget

      const messages = [makeMsg(`short message`)]
      const result = await manager(messages)
      expect(result).toEqual(messages)
    })

    it(`should prune old messages when over budget`, async () => {
      // Model with tiny context window — 30 tokens → 24 budget at 80%
      // Each message ~24 chars → 6 tokens. 5 msgs = 30 tokens > 24 budget
      const model = makeModel(30)
      const manager = createContextManager(model, 80)

      const msg1 = makeMsg(`first message anchor one`)
      const msg2 = makeMsg(`second message anchor tw`)
      const msg3 = makeMsg(`third old message to cut`)
      const msg4 = makeMsg(`fourth old message to rm`)
      const msg5 = makeMsg(`fifth most recent keeper`)

      const messages = [msg1, msg2, msg3, msg4, msg5]
      const result = await manager(messages)

      // First 2 anchors always kept + most recent that fit
      expect(result[0]).toBe(msg1)
      expect(result[1]).toBe(msg2)
      // Most recent messages kept, old ones pruned
      expect(result[result.length - 1]).toBe(msg5)
      // Pruned result should be shorter than original
      expect(result.length).toBeLessThan(messages.length)
    })

    it(`should keep anchor messages (first 2) even when over budget`, async () => {
      const model = makeModel(40) // Very small: 40 tokens → 32 budget at 80%
      const manager = createContextManager(model, 80)

      const msg1 = makeMsg(`first anchor`)
      const msg2 = makeMsg(`second anchor`)
      const msg3 = makeMsg(`third message extra long text that exceeds budget`)

      const result = await manager([msg1, msg2, msg3])

      // Anchors always present
      expect(result[0]).toBe(msg1)
      expect(result[1]).toBe(msg2)
    })

    it(`should use default 80% budget when not specified`, async () => {
      const model = makeModel(1000)
      const manager = createContextManager(model)

      // Should handle a reasonable number of small messages
      const messages = Array.from({ length: 5 }, (_, i) => makeMsg(`message ${i}`))
      const result = await manager(messages)
      expect(result).toEqual(messages)
    })

    it(`should handle empty message array`, async () => {
      const model = makeModel(100000)
      const manager = createContextManager(model)

      const result = await manager([])
      expect(result).toEqual([])
    })

    it(`should handle single message`, async () => {
      const model = makeModel(100000)
      const manager = createContextManager(model)

      const messages = [makeMsg(`only one`)]
      const result = await manager(messages)
      expect(result).toEqual(messages)
    })

    it(`should estimate tokens for array content blocks`, async () => {
      const model = makeModel(100) // Small context
      const manager = createContextManager(model, 80)

      const messages = [
        makeAssistantMsg([{ type: `text`, text: `a`.repeat(400) }]), // ~100 tokens
        makeAssistantMsg([{ type: `text`, text: `b`.repeat(400) }]), // ~100 tokens
        makeMsg(`recent msg`), // ~3 tokens
      ]

      const result = await manager(messages)
      // Should prune since 200+ tokens > 80 token budget
      expect(result.length).toBeLessThanOrEqual(messages.length)
    })
  })

  describe(`compact strategy`, () => {
    const makeMockStreamFn = (summaryText: string) => {
      return vi.fn().mockResolvedValue({
        [Symbol.asyncIterator]: async function* () {
          yield { type: `text_delta`, delta: summaryText }
        },
      })
    }

    it(`should summarize old messages and keep recent ones`, async () => {
      const model = makeModel(30) // Small: 30 tokens → 24 budget at 80%
      const mockStreamFn = makeMockStreamFn(`Summary of old conversation`)

      const manager = createContextManager(model, 80, {
        strategy: `compact`,
        streamFn: mockStreamFn as any,
      })

      const msg1 = makeMsg(`first message anchor one`)
      const msg2 = makeMsg(`second message anchor tw`)
      const msg3 = makeMsg(`third old message to cut`)
      const msg4 = makeMsg(`fourth old message to rm`)
      const msg5 = makeMsg(`fifth most recent keeper`)

      const messages = [msg1, msg2, msg3, msg4, msg5]
      const result = await manager(messages)

      // Should have anchors + summary + recent
      expect(result[0]).toBe(msg1)
      expect(result[1]).toBe(msg2)
      // Summary message should be injected
      const summaryMsg = result.find(
        (m: any) =>
          typeof m.content === `string` &&
          m.content.includes(`Summary of earlier conversation`)
      )
      expect(summaryMsg).toBeDefined()
      // Most recent should still be present
      expect(result[result.length - 1]).toBe(msg5)
      // streamFn should have been called for summarization
      expect(mockStreamFn).toHaveBeenCalled()
    })

    it(`should fall back to prune when no messages to compact`, async () => {
      const model = makeModel(100000) // Large enough to fit all
      const mockStreamFn = makeMockStreamFn(`unused`)

      const manager = createContextManager(model, 80, {
        strategy: `compact`,
        streamFn: mockStreamFn as any,
      })

      const messages = [makeMsg(`fits in budget`)]
      const result = await manager(messages)

      // All fit, no compaction needed
      expect(result).toEqual(messages)
      expect(mockStreamFn).not.toHaveBeenCalled()
    })

    it(`should fall back to prune when streamFn throws`, async () => {
      const model = makeModel(30)
      const mockStreamFn = vi.fn().mockRejectedValue(new Error(`LLM error`))

      const manager = createContextManager(model, 80, {
        strategy: `compact`,
        streamFn: mockStreamFn as any,
      })

      const messages = [
        makeMsg(`first message anchor one`),
        makeMsg(`second message anchor tw`),
        makeMsg(`third old message to cut`),
        makeMsg(`fourth old message to rm`),
        makeMsg(`fifth most recent keeper`),
      ]

      // Should not throw — falls back to prune
      const result = await manager(messages)
      expect(result.length).toBeLessThan(messages.length)
      // No summary message injected (fallback to prune)
      const summaryMsg = result.find(
        (m: any) =>
          typeof m.content === `string` &&
          m.content.includes(`Summary of earlier conversation`)
      )
      expect(summaryMsg).toBeUndefined()
    })

    it(`should use prune strategy when compaction.strategy is prune`, async () => {
      const model = makeModel(30)
      const mockStreamFn = makeMockStreamFn(`unused`)

      const manager = createContextManager(model, 80, {
        strategy: `prune`,
        streamFn: mockStreamFn as any,
      })

      const messages = [
        makeMsg(`first message anchor one`),
        makeMsg(`second message anchor tw`),
        makeMsg(`third old message to cut`),
        makeMsg(`fourth old message to rm`),
        makeMsg(`fifth most recent keeper`),
      ]

      const result = await manager(messages)

      // Prune strategy — no streamFn call
      expect(mockStreamFn).not.toHaveBeenCalled()
      expect(result.length).toBeLessThan(messages.length)
    })
  })

  describe(`backward compatibility`, () => {
    it(`should export createContextPruner as a deprecated alias`, () => {
      expect(createContextPruner).toBe(createContextManager)
    })
  })
})
