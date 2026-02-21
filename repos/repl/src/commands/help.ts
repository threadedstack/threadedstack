import type { TSlashCommand } from '@TRL/types'
import { registeredCommands } from './registry'

export const helpCommand: TSlashCommand = {
  name: `help`,
  aliases: [`h`],
  description: `Show available commands`,
  handler: async (_args, ctx) => {
    const all = [helpCommand, ...registeredCommands]
    const lines = all.map((cmd) => {
      const aliases = cmd.aliases.length ? ` (${cmd.aliases.join(`, `)})` : ''
      return `/${cmd.name}${aliases} — ${cmd.description}`
    })
    ctx.output(`Available commands:\n${lines.join('\n')}`)
  },
}
