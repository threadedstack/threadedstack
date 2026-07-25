import type { TSlashCommandContext } from '@TSA/types'

import { describe, it, expect, vi } from 'vitest'
import { switchThreadCommand } from './switchThread'

const makeCtx = (overrides: Partial<TSlashCommandContext> = {}): TSlashCommandContext =>
  ({
    output: vi.fn(),
    setThreadId: vi.fn(),
    clearMessages: vi.fn(),
    loadThreadMessages: vi.fn().mockResolvedValue(undefined),
    listThreads: vi.fn().mockResolvedValue([]),
    showMenu: vi.fn(),
    ...overrides,
  }) as unknown as TSlashCommandContext

describe(`/switch command`, () => {
  it(`delegates to listThreadsCommand.handler when args is falsy, without directly setting a thread id itself`, async () => {
    const ctx = makeCtx()

    await switchThreadCommand.handler(``, ctx)

    expect(ctx.listThreads).toHaveBeenCalled()
    expect(ctx.setThreadId).not.toHaveBeenCalled()
    expect(ctx.loadThreadMessages).not.toHaveBeenCalled()
  })

  it(`switches directly to the given thread id when loadThreadMessages resolves`, async () => {
    const ctx = makeCtx()

    await switchThreadCommand.handler(`t-123`, ctx)

    expect(ctx.setThreadId).toHaveBeenCalledWith(`t-123`)
    expect(ctx.clearMessages).toHaveBeenCalled()
    expect(ctx.loadThreadMessages).toHaveBeenCalledWith(`t-123`)
    expect(ctx.output).toHaveBeenCalledWith(`Switched to thread t-123`)
  })

  it(`outputs the error message when loadThreadMessages rejects with an Error`, async () => {
    const ctx = makeCtx({
      loadThreadMessages: vi.fn().mockRejectedValue(new Error(`not found`)),
    })

    await switchThreadCommand.handler(`t-123`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error loading thread: not found`)
  })

  it(`falls back to String(err) when loadThreadMessages rejects with a non-Error`, async () => {
    const ctx = makeCtx({
      loadThreadMessages: vi.fn().mockRejectedValue(`plain string error`),
    })

    await switchThreadCommand.handler(`t-123`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error loading thread: plain string error`)
  })

  it(`trims surrounding whitespace before using the thread id`, async () => {
    const ctx = makeCtx()

    await switchThreadCommand.handler(`  t-123  `, ctx)

    expect(ctx.setThreadId).toHaveBeenCalledWith(`t-123`)
    expect(ctx.loadThreadMessages).toHaveBeenCalledWith(`t-123`)
    expect(ctx.output).toHaveBeenCalledWith(`Switched to thread t-123`)
  })
})
