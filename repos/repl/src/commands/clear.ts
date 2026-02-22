import type { TSlashCommand } from '@TRL/types'

export const clearCommand: TSlashCommand = {
  name: `clear`,
  aliases: [`cl`],
  description: `Clear screen and start new thread`,
  handler: async (_args, ctx) => {
    ctx.clearMessages()
    try {
      const thread = await ctx.createThread()
      ctx.setThreadId(thread.id)
    } catch {
      ctx.setThreadId(null)
    }
  },
}
