import type { TSlashCommand } from '@TRL/types'

export const switchAgentCommand: TSlashCommand = {
  name: 'agent',
  aliases: ['a'],
  description: 'Switch to a different agent',
  handler: async (args, ctx) => {
    if (!args) return 'Usage: /agent <agent-id>'
    ctx.setAgentId(args.trim())
    ctx.setThreadId(null)
    ctx.clearMessages()
    ctx.output(`Switched to agent ${args.trim()}`)
  },
}
