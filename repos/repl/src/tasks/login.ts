import type { TTask } from '@TRL/types'

import { bold, red } from '@TRL/display/colors'

export const login: TTask = {
  name: `login`,
  alias: [`li`],
  description: `Authenticate with a ThreadedStack API key`,
  example: `tdsk-agent login <api-key> [--url <proxy-url>] [--insecure]`,
  options: {
    apiKey: {
      description: `API key for authentication`,
      example: `--apiKey tdsk_xxx`,
      type: `str`,
    },
    url: {
      description: `Custom proxy URL`,
      example: `--url https://proxy.example.com`,
      type: `str`,
    },
    insecure: {
      description: `Skip TLS certificate validation`,
      example: `--insecure`,
      type: `bool`,
      default: false,
    },
  },
  action: async ({ params, auth, renderer, options }) => {
    const apiKey = params.apiKey || options?.[0]
    if (!apiKey) {
      renderer.renderWarning(
        `Usage: tdsk-agent login <api-key> [--url <proxy-url>] [--insecure]`
      )
      process.exit(1)
    }

    const spinner = renderer.spinner(`Validating API key...`)
    try {
      await auth.login(apiKey, params.url, params.insecure === true)
      spinner.stop()
      renderer.renderSuccess(`Logged in successfully`)
    } catch (err) {
      spinner.stop()
      const msg = err instanceof Error ? err.message : `Login failed`
      process.stdout.write(`${red(bold(`Error:`))} ${msg}\n`)
      process.exit(1)
    }
  },
}
