import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'

export const login: TTask = {
  name: `login`,
  alias: [`li`],
  description: `Authenticate with a Threaded Stack API key`,
  example: `tsa login <api-key> [--url <proxy-url>] [--insecure]`,
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
  action: async ({ params, auth, options }) => {
    const apiKey = params.apiKey || options?.[0]
    if (!apiKey) {
      process.stdout.write(
        `${themed('warning', `Usage: tsa login <api-key> [--url <proxy-url>] [--insecure]`)}\n`
      )
      process.exit(1)
    }

    process.stdout.write(`${themed('muted', `Validating API key...`)}\n`)
    try {
      await auth.login(apiKey, params.url, params.insecure === true)
      process.stdout.write(`${themed('success', `Logged in successfully`)}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Login failed`
      process.stdout.write(`${themed('error', `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  },
}
