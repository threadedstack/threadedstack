import type { TSlashCommand } from '@TRL/types'

export const listThreadsCommand: TSlashCommand = {
  name: 'threads',
  aliases: ['t'],
  description: 'List conversation threads',
  handler: async (_args, _ctx) => {
    return undefined
  },
}
