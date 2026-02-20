import type { TSlashCommand } from '@TRL/types'
import { DefaultProxyUrl } from '@TRL/constants'

export const loginCommand: TSlashCommand = {
  name: `login`,
  aliases: [`li`],
  description: `Authenticate with an API key`,
  handler: async (args, ctx) => {
    if (!args) {
      ctx.output(`Usage: /login <api-key> [--url <proxy-url>] [--insecure]`)
      return
    }

    const parts = args.split(/\s+/)
    const apiKey = parts[0]
    const insecure = parts.includes(`--insecure`)

    let proxyUrl: string | undefined
    const urlIdx = parts.indexOf(`--url`)
    if (urlIdx !== -1 && parts[urlIdx + 1]) proxyUrl = parts[urlIdx + 1]

    ctx.output(`Validating API key...`)

    try {
      await ctx.auth.login(apiKey, proxyUrl || DefaultProxyUrl, insecure)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Login failed`
      ctx.output(`Error: ${msg}`)
    }
  },
}
