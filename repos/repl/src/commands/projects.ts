import type { TSlashCommand } from '@TRL/types'

export const projectsCommand: TSlashCommand = {
  name: `projects`,
  aliases: [`proj`],
  description: `Switch project`,
  handler: async (_args, ctx) => {
    await ctx.switchProject()
  },
}
