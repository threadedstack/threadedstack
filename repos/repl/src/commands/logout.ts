import type { TSlashCommand } from '@TRL/types'

export const logoutCommand: TSlashCommand = {
  name: `logout`,
  aliases: [`lo`],
  description: `Remove stored credentials`,
  handler: async (_args, ctx) => {
    ctx.auth.logout()
    ctx.output(`Logged out`)
  },
}
