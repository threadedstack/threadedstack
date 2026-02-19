import type { TSlashCommand } from '@TRL/types'

export const switchThreadCommand: TSlashCommand = {
  name: 'switch',
  aliases: ['sw'],
  description: 'Switch to a different thread',
  handler: async (args, ctx) => {
    if (!args) return 'Usage: /switch <thread-id>'
    ctx.setThreadId(args.trim())
  },
}
