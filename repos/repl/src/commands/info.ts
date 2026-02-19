import type { TSlashCommand } from '@TRL/types'

export const infoCommand: TSlashCommand = {
  name: 'info',
  aliases: ['i'],
  description: 'Show current session info',
  handler: async (_args, _ctx) => {
    return undefined
  },
}
