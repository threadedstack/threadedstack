import type { TSlashCommand } from '@TRL/types'

export const clearCommand: TSlashCommand = {
  name: 'clear',
  aliases: ['cl'],
  description: 'Clear the screen',
  handler: async (_args, _ctx) => {
    process.stdout.write('\x1B[2J\x1B[0;0H')
  },
}
