import type { TSlashCommand } from '@TRL/types'

export const addContextCommand: TSlashCommand = {
  name: `add`,
  aliases: [],
  description: `Add a context file`,
  handler: async (args, ctx) => {
    if (!args) return `Usage: /add <file-path>`
    ctx.addContextFile(args.trim())
  },
}
