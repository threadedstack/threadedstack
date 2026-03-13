import type { TSlashCommand } from '@TRL/types'

export const switchProviderCommand: TSlashCommand = {
  name: `provider`,
  aliases: [`p`],
  description: `Switch LLM provider`,
  handler: async (args, ctx) => {
    if (!args) return `Usage: /provider <provider-id>`
    const providerId = args.trim()
    ctx.setProviderId(providerId)
    ctx.output(`Switched to provider ${providerId}`)
  },
}
