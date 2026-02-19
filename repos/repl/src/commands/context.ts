import type { TSlashCommand } from '@TRL/types'

export const contextCommand: TSlashCommand = {
  name: 'context',
  aliases: ['ctx'],
  description: 'List loaded context files',
  handler: async (_args, _ctx) => {
    return undefined
  },
}
