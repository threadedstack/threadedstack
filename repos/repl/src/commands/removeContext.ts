import type { TSlashCommand } from '@TRL/types'

export const removeContextCommand: TSlashCommand = {
  name: 'remove',
  aliases: ['rm'],
  description: 'Remove a context file by index',
  handler: async (args, ctx) => {
    const index = Number.parseInt(args, 10)
    if (isNaN(index)) return 'Usage: /remove <index>'
    ctx.removeContextFile(index)
  },
}
