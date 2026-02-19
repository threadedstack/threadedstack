import type { TSlashCommand } from '@TRL/types'

export const historyCommand: TSlashCommand = {
  name: 'history',
  aliases: ['hist'],
  description: 'Show conversation history',
  handler: async (_args, _ctx) => {
    return undefined
  },
}
