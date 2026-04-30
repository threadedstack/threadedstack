import type { TSlashCommand } from '@TSA/types'
import { browserLogin } from '@TSA/services/browserAuth'
import { resolveAuthUrl, resolveProxyUrl } from '@TSA/utils/tasks/resolveUrls'

export const loginCommand: TSlashCommand = {
  name: `login`,
  aliases: [`li`],
  description: `Authenticate with an API key or browser login`,
  handler: async (args, ctx) => {
    const proxyUrl = ctx.auth.proxyUrl || resolveProxyUrl()

    if (!args) {
      const authUrl = resolveAuthUrl()
      try {
        new URL(authUrl)
      } catch {
        ctx.output(`Error: Invalid auth URL: ${authUrl}`)
        ctx.output(`Check your TDSK_AUTH_URL or config auth URL.`)
        return
      }
      ctx.output(`Opening browser for authentication...`)

      try {
        const result = await browserLogin(authUrl)
        ctx.output(`Validating session...`)
        await ctx.auth.loginWithToken({ ...result, proxyUrl })
        ctx.output(`Logged in successfully.`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Browser login failed`
        ctx.output(`Error: ${msg}`)
        ctx.output(
          `Try /login <api-key> for API key auth, or check your network connection.`
        )
      }
      return
    }

    const parts = args.split(/\s+/)
    const apiKey = parts[0]
    const insecure = parts.includes(`--insecure`)

    let customUrl: string | undefined
    const urlIdx = parts.indexOf(`--url`)
    if (urlIdx !== -1 && parts[urlIdx + 1]) customUrl = parts[urlIdx + 1]

    ctx.output(`Validating API key...`)

    try {
      await ctx.auth.login(apiKey, customUrl || proxyUrl, insecure)
      ctx.output(`Logged in successfully.`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Login failed`
      ctx.output(`Error: ${msg}`)
    }
  },
}
