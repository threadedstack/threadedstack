import type { TSlashCommand } from '@TRL/types'

export const switchProviderCommand: TSlashCommand = {
  name: 'provider',
  aliases: ['p'],
  description: 'Switch LLM provider',
  handler: async (args, ctx) => {
    if (!args) return 'Usage: /provider <provider-id>'
    ctx.setProviderId(args.trim())
  },
}
