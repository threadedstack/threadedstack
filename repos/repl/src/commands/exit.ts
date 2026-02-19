import type { TSlashCommand } from '@TRL/types'

export const exitCommand: TSlashCommand = {
  name: 'exit',
  aliases: ['quit', 'q'],
  description: 'Exit the REPL',
  handler: async (_args, ctx) => {
    ctx.exit()
  },
}
