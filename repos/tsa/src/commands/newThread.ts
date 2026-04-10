import type { TSlashCommand } from '@TSA/types'

export const newThreadCommand: TSlashCommand = {
  name: `new`,
  aliases: [`n`],
  description: `Start a new conversation thread`,
  handler: async (_args, ctx) => {
    ctx.setThreadId(null)
    ctx.clearMessages()
    ctx.output(`Started new thread.`)
  },
}
