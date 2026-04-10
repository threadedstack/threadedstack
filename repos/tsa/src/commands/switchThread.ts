import type { TSlashCommand } from '@TSA/types'

import { listThreadsCommand } from './listThreads'

export const switchThreadCommand: TSlashCommand = {
  name: `switch`,
  aliases: [`sw`],
  description: `Switch to a different thread`,
  handler: async (args, ctx) => {
    if (!args) return listThreadsCommand.handler(``, ctx)

    const threadId = args.trim()
    ctx.setThreadId(threadId)
    ctx.clearMessages()
    try {
      await ctx.loadThreadMessages(threadId)
      ctx.output(`Switched to thread ${threadId}`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      ctx.output(`Error loading thread: ${msg}`)
    }
  },
}
