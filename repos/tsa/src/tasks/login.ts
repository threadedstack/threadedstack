import type { TTask } from '@TSA/types'

import { themed } from '@TSA/theme'
import { ApiClient } from '@TSA/services/api'
import { ConfigService } from '@TSA/services/config'
import { browserLogin } from '@TSA/services/browserAuth'
import { resolveOrgId } from '@TSA/utils/tasks/resolveOrgId'
import { resolveAuthUrl, resolveProxyUrl } from '@TSA/utils/tasks/resolveUrls'

export const login: TTask = {
  name: `login`,
  alias: [`li`],
  description: `Authenticate with a Threaded Stack API key or browser login`,
  example: `tsa login [<api-key>] [--url <proxy-url>] [--insecure]`,
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
  action: async ({ params, auth, options, config }) => {
    const apiKey = params.apiKey || options?.[0]
    const proxyUrl = params.url || resolveProxyUrl(config)
    const insecure = params.insecure === true

    if (apiKey) {
      process.stdout.write(`${themed('muted', `Validating API key...`)}\n`)
      try {
        await auth.login(apiKey, proxyUrl, insecure)
        process.stdout.write(`${themed('success', `Logged in successfully`)}\n`)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `Login failed`
        process.stdout.write(`${themed('error', `Error:`)} ${msg}\n`)
        process.exit(1)
      }
      return
    }

    const authUrl = resolveAuthUrl(config)
    try {
      new URL(authUrl)
    } catch {
      process.stdout.write(`${themed('error', `Error:`)} Invalid auth URL: ${authUrl}\n`)
      process.exit(1)
    }

    process.stdout.write(`${themed('muted', `Opening browser for authentication...`)}\n`)

    try {
      const result = await browserLogin(authUrl)
      process.stdout.write(`${themed(`muted`, `Validating session...`)}\n`)
      await auth.loginWithToken({ ...result, proxyUrl, insecure })

      process.stdout.write(`${themed(`muted`, `Creating session key...`)}\n`)
      const api = new ApiClient(auth)

      let sessionKeyCreated = false
      try {
        const orgId = await resolveOrgId(api, undefined, config?.org)
        const keyResp = await api.createCliSessionKey(orgId)

        if (keyResp.ok && keyResp.data?.key) {
          await auth.login(keyResp.data.key, proxyUrl, insecure, keyResp.data.id)
          sessionKeyCreated = true
        } else {
          const errMsg = keyResp.error?.message || `server returned ${keyResp.status}`
          process.stderr.write(
            `${themed(`warning`, `Warning: could not create long-lived session key: ${errMsg}`)}\n` +
              `${themed(`muted`, `You are logged in with a short-lived token that will expire. Run "tsa login" again to retry.`)}\n`
          )
        }

        ConfigService.updateKey(`org`, orgId)
      } catch (err) {
        const msg = err instanceof Error ? err.message : `unknown error`
        process.stderr.write(
          `${themed(`warning`, `Warning: could not create long-lived session key: ${msg}`)}\n` +
            `${themed(`muted`, `You are logged in with a short-lived token that will expire. Run "tsa login" again to retry.`)}\n`
        )
      }

      process.stdout.write(
        `${themed('success', `Logged in successfully${sessionKeyCreated ? `` : ` (short-lived token)`}`)}\n`
      )
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Browser login failed`
      process.stdout.write(`${themed('error', `Error:`)} ${msg}\n`)
      process.exit(1)
    }
  },
}
