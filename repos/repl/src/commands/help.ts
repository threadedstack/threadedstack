import type { TSlashCommand } from '@TRL/types'

export const helpCommand: TSlashCommand = {
  name: 'help',
  aliases: ['h'],
  description: 'Show available commands',
  handler: async (_args, _ctx) => {
    return undefined
  },
}
