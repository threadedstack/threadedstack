import { describe, it, expect, vi } from 'vitest'
import { InterpreterService } from './interpreter'
import { EParserEvtType } from '@tdsk/domain'
import type { TParsedEvent, TGuiConfig } from '@tdsk/domain'

vi.mock('@TBE/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

vi.mock('@earendil-works/pi-ai', () => ({
  getModel: vi.fn(() => ({
    id: 'test-model',
    name: 'Test',
    api: 'openai-completions',
    provider: 'openai',
  })),
  streamSimple: vi.fn(),
}))

const { streamSimple } = await import('@earendil-works/pi-ai')

function mockStream(text: string): any {
  return (async function* () {
    yield { type: 'text_delta' as const, delta: text }
    yield { type: 'done' as const, stopReason: 'stop' as const }
  })()
}

const testConfig: TGuiConfig = {
  enabled: true,
  providerId: 'prov-1',
  model: 'test-model',
  maxRetries: 1,
}

describe('InterpreterService', () => {
  it('should return parsed tree for valid JSON response', async () => {
    const tree = JSON.stringify({
      type: 'div',
      props: null,
      children: [
        {
          type: 'Select',
          props: {
            interactionType: 'NumberSelect',
            options: [
              { label: 'Redis', value: 'Redis' },
              { label: 'PostgreSQL', value: 'PostgreSQL' },
            ],
          },
          children: [],
        },
      ],
    })
    vi.mocked(streamSimple).mockResolvedValue(mockStream(tree))

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-1',
        events: [
          {
            type: EParserEvtType.Text,
            content: '1. Redis\n2. PostgreSQL',
            timestamp: Date.now(),
          },
        ],
      },
      testConfig,
      'anthropic',
      'sk-test-key'
    )

    expect(result).not.toBeNull()
    expect(result!.tree.type).toBe('div')
  })

  it('should return null when interpreter returns null string', async () => {
    vi.mocked(streamSimple).mockResolvedValue(mockStream('null'))

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-1',
        events: [
          {
            type: EParserEvtType.Text,
            content: 'Just plain text.',
            timestamp: Date.now(),
          },
        ],
      },
      testConfig,
      'anthropic',
      'sk-test-key'
    )

    expect(result).toBeNull()
  })

  it('should return null after exhausting retries on invalid JSON', async () => {
    vi.mocked(streamSimple).mockResolvedValue(mockStream('not valid json'))

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-1',
        events: [
          { type: EParserEvtType.Text, content: '1. A\n2. B', timestamp: Date.now() },
        ],
      },
      { ...testConfig, maxRetries: 0 },
      'anthropic',
      'sk-test-key'
    )

    expect(result).toBeNull()
  })

  it('should strip markdown fences from response', async () => {
    const tree = JSON.stringify({ type: 'div', props: null, children: ['hello'] })
    const wrapped = '```json\n' + tree + '\n```'
    vi.mocked(streamSimple).mockResolvedValue(mockStream(wrapped))

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-1',
        events: [
          { type: EParserEvtType.Text, content: '1. A\n2. B', timestamp: Date.now() },
        ],
      },
      testConfig,
      'anthropic',
      'sk-test-key'
    )

    expect(result).not.toBeNull()
  })

  it('should retry and succeed on second attempt', async () => {
    vi.mocked(streamSimple)
      .mockResolvedValueOnce(mockStream('not valid json'))
      .mockResolvedValueOnce(
        mockStream(
          JSON.stringify({
            type: 'div',
            props: null,
            children: [{ type: 'Confirm', props: { prompt: 'Continue?' }, children: [] }],
          })
        )
      )

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-retry',
        events: [
          {
            type: EParserEvtType.Text,
            content: 'Continue? (y/n)',
            timestamp: Date.now(),
          },
        ],
      },
      testConfig,
      'anthropic',
      'sk-test-key'
    )

    expect(result).not.toBeNull()
    expect(result!.tree.type).toBe('div')
  })

  it('should return null when provider/model is not found', async () => {
    const { getModel } = await import('@earendil-works/pi-ai')
    vi.mocked(streamSimple).mockClear()
    vi.mocked(getModel).mockReturnValueOnce(undefined as any)

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-unknown',
        events: [
          { type: EParserEvtType.Text, content: '1. A\n2. B', timestamp: Date.now() },
        ],
      },
      testConfig,
      'not-a-real-provider',
      'sk-test-key'
    )

    expect(result).toBeNull()
    expect(streamSimple).not.toHaveBeenCalled()
  })

  it('should return null for empty user message', async () => {
    vi.mocked(streamSimple).mockClear()

    const service = new InterpreterService()
    const result = await service.interpret(
      {
        chunkId: 'chunk-empty',
        events: [{ type: EParserEvtType.Activity, timestamp: Date.now() } as any],
      },
      testConfig,
      'anthropic',
      'sk-test-key'
    )

    expect(result).toBeNull()
    expect(streamSimple).not.toHaveBeenCalled()
  })
})
