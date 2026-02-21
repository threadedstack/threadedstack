import type { TSlashCommand } from '@TRL/types'

export const clearCommand: TSlashCommand = {
  name: `clear`,
  aliases: [`cl`],
  description: `Clear the screen`,
  handler: async (_args, ctx) => {
    ctx.clearMessages()
  },
}
