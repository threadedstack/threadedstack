import type { TSlashCommand } from '@TSA/types'

export const exitCommand: TSlashCommand = {
  name: `exit`,
  aliases: [`quit`, `q`],
  description: `Exit tsa cli`,
  handler: async (_args, ctx) => {
    ctx.exit()
  },
}
