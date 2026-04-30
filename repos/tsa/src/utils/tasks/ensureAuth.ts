import type { TTaskAction } from '@TSA/types'
import type { TBrowserAuthResult } from '@TSA/types'

import { themed } from '@TSA/theme'
import { isLocalUrl } from '@TSA/utils/api/isLocalUrl'
import { browserLogin } from '@TSA/services/browserAuth'
import { TokenRefreshService } from '@TSA/services/tokenRefresh'
import { resolveAuthUrl, resolveProxyUrl } from '@TSA/utils/tasks/resolveUrls'

export const ensureAuth =
  (action: TTaskAction): TTaskAction =>
  async (args) => {
    const { auth, config } = args

    if (auth.loggedIn() && !auth.isExpired()) return action(args)

    if (auth.loggedIn() && auth.isExpired()) {
      try {
        const refresher = new TokenRefreshService(auth)
        const refreshed = await refresher.maybeRefresh()
        if (refreshed && auth.loggedIn() && !auth.isExpired()) return action(args)
        if (process.stdin.isTTY) {
          process.stdout.write(
            `${themed(`muted`, `Session expired and token refresh failed. Re-authenticating...`)}\n`
          )
        }
      } catch {
        if (process.stdin.isTTY) {
          process.stdout.write(
            `${themed(`muted`, `Session expired. Re-authenticating...`)}\n`
          )
        }
      }
    }

    if (!process.stdin.isTTY) {
      const msg = auth.loggedIn()
        ? `${themed(`error`, `Session expired.`)} Run ${themed(`primary`, `tsa login`)} to re-authenticate.\n`
        : `${themed(`error`, `Not logged in.`)} Run ${themed(`primary`, `tsa login`)} first.\n`
      process.stdout.write(msg)
      process.exit(1)
    }

    const authUrl = resolveAuthUrl(config)
    const proxyUrl = resolveProxyUrl(config)

    process.stdout.write(`${themed(`muted`, `Opening browser to log in...`)}\n`)

    let result: TBrowserAuthResult
    try {
      result = await browserLogin(authUrl)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Browser login failed`
      process.stdout.write(`${themed(`error`, `Error:`)} ${msg}\n`)
      process.exit(1)
    }

    try {
      const insecure = isLocalUrl(proxyUrl)
      await auth.loginWithToken({ ...result, proxyUrl, insecure })
      if (insecure) process.env.NODE_TLS_REJECT_UNAUTHORIZED = `0`
      process.stdout.write(`${themed(`success`, `Logged in successfully`)}\n`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : `Failed to store credentials`
      process.stdout.write(
        `${themed(`error`, `Error:`)} Authentication succeeded but credentials could not be saved: ${msg}\n`
      )
      process.exit(1)
    }

    return action(args)
  }
