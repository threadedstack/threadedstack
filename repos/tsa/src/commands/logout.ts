import type { TSlashCommand } from '@TSA/types'

export const logoutCommand: TSlashCommand = {
  name: `logout`,
  aliases: [`lo`],
  description: `Remove stored credentials`,
  handler: async (_args, ctx) => {
    await ctx.auth.logout()
    ctx.output(`Logged out`)
  },
}
