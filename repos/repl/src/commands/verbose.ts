import type { TSlashCommand } from '@TRL/types'

export const verboseCommand: TSlashCommand = {
  name: `verbose`,
  aliases: [`v`],
  description: `Toggle verbose output`,
  handler: async (_args, ctx) => {
    ctx.setVerbose(!ctx.verbose)
  },
}
