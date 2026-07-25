import type { TSlashCommandContext } from '@TSA/types'

import { describe, it, expect, vi } from 'vitest'
import { historyCommand } from './history'

const makeCtx = (overrides: Partial<TSlashCommandContext> = {}): TSlashCommandContext =>
  ({
    output: vi.fn(),
    messages: [],
    ...overrides,
  }) as unknown as TSlashCommandContext

describe(`/history command`, () => {
  it(`outputs a no-messages message when ctx.messages is empty`, async () => {
    const ctx = makeCtx()

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`No messages in this session.`)
  })

  it(`prefixes a user message with "> "`, async () => {
    const ctx = makeCtx({ messages: [{ type: `user`, content: `hi` }] as any })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`> hi`)
  })

  it(`prefixes an assistant message with two spaces`, async () => {
    const ctx = makeCtx({ messages: [{ type: `assistant`, content: `hi there` }] as any })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`  hi there`)
  })

  it(`prefixes an unrecognized message type with "# "`, async () => {
    const ctx = makeCtx({ messages: [{ type: `system`, content: `note` }] as any })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`# note`)
  })

  it(`truncates content over 120 chars to 120 chars plus "..."`, async () => {
    const longContent = `x`.repeat(150)
    const ctx = makeCtx({ messages: [{ type: `user`, content: longContent }] as any })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`> ${`x`.repeat(120)}...`)
  })

  it(`uses content verbatim when it is 120 chars or fewer`, async () => {
    const exactContent = `x`.repeat(120)
    const ctx = makeCtx({ messages: [{ type: `user`, content: exactContent }] as any })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`> ${exactContent}`)
  })

  it(`joins multiple messages into a single output call`, async () => {
    const ctx = makeCtx({
      messages: [
        { type: `user`, content: `hi` },
        { type: `assistant`, content: `hello` },
        { type: `system`, content: `note` },
      ] as any,
    })

    await historyCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledTimes(1)
    expect(ctx.output).toHaveBeenCalledWith(`> hi\n  hello\n# note`)
  })
})
