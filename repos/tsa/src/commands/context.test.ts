import type { TSlashCommandContext } from '@TSA/types'

import { describe, it, expect, vi } from 'vitest'
import { contextCommand } from './context'

const makeCtx = (overrides: Partial<TSlashCommandContext> = {}): TSlashCommandContext =>
  ({
    output: vi.fn(),
    contextFiles: [],
    ...overrides,
  }) as unknown as TSlashCommandContext

describe(`/context command`, () => {
  it(`outputs a no-context-files message when ctx.contextFiles is empty`, async () => {
    const ctx = makeCtx()

    await contextCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No context files loaded.`)
  })

  it(`lists a single file numbered 1`, async () => {
    const ctx = makeCtx({
      contextFiles: [
        { name: `foo.ts`, path: `/src/foo.ts`, content: ``, sizeBytes: 512 },
      ] as any,
    })

    await contextCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(
      `Context files:\n  1. foo.ts (/src/foo.ts, 512 bytes)`
    )
  })

  it(`numbers multiple files sequentially starting at 1, joined by newline`, async () => {
    const ctx = makeCtx({
      contextFiles: [
        { name: `foo.ts`, path: `/src/foo.ts`, content: ``, sizeBytes: 512 },
        { name: `bar.ts`, path: `/src/bar.ts`, content: ``, sizeBytes: 1024 },
      ] as any,
    })

    await contextCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(
      `Context files:\n  1. foo.ts (/src/foo.ts, 512 bytes)\n  2. bar.ts (/src/bar.ts, 1024 bytes)`
    )
  })
})
