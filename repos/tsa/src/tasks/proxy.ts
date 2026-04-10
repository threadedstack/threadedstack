import type { TTask } from '@TSA/types'

import WebSocket from 'ws'
import { UpstreamTimeoutMS } from '@TSA/constants/values'

/**
 * ProxyCommand transport for SSH tunneling.
 * Called by SSH client, NOT by user directly.
 * Bridges stdin/stdout <-> WebSocket binary frames to backend tunnel endpoint.
 */
export const proxy: TTask = {
  name: `proxy`,
  alias: [],
  example: `tsa proxy <sandbox-id>`,
  description: `SSH ProxyCommand transport (internal)`,
  options: {},
  action: async ({ auth, options }) => {
    const sandboxId = options?.[0]
    if (!sandboxId) {
      process.stderr.write(`Usage: tsa proxy <sandbox-id>\n`)
      process.exit(1)
    }

    const creds = auth.creds()
    if (!creds) {
      process.stderr.write(`Not logged in. Run "tsa login" first.\n`)
      process.exit(1)
    }

    const wsUrl = creds.proxyUrl.replace(/^https:/, `wss:`).replace(/^http:/, `ws:`)
    const tunnelUrl = `${wsUrl}/_/sandboxes/${sandboxId}/tunnel`

    const ws = new WebSocket(tunnelUrl, {
      headers: {
        Authorization: `Bearer ${creds.apiKey}`,
      },
      rejectUnauthorized: !creds.insecure,
    })

    ws.binaryType = `nodebuffer`

    // Buffer stdin data until the upstream tunnel is fully connected.
    // SSH writes its version string immediately, but Caddy drops early
    // WebSocket frames sent before the upstream proxy chain is established.
    // We detect upstream readiness by waiting for the first server message
    // (the SSH banner).
    const pendingStdin: Buffer[] = []
    let upstreamReady = false

    process.stdin.on(`data`, (chunk: Buffer) => {
      if (upstreamReady && ws.readyState === WebSocket.OPEN) {
        ws.send(chunk)
      } else {
        pendingStdin.push(chunk)
      }
    })

    process.stdin.on(`end`, () => {
      if (ws.readyState === WebSocket.OPEN) ws.close()
    })

    process.stdin.resume()

    ws.on(`open`, () => {
      const readyTimer = setTimeout(() => {
        if (!upstreamReady) {
          process.stderr.write(
            `Tunnel timeout: no response from sandbox SSH within ${UpstreamTimeoutMS / 1000}s. ` +
              `The sandbox may not have SSHD running.\n`
          )
          ws.close()
          process.exit(1)
        }
      }, UpstreamTimeoutMS)

      ws.on(`message`, (data: Buffer) => {
        process.stdout.write(data)
        if (!upstreamReady) {
          upstreamReady = true
          clearTimeout(readyTimer)
          for (const chunk of pendingStdin) {
            if (ws.readyState === WebSocket.OPEN) ws.send(chunk)
          }
          pendingStdin.length = 0
        }
      })
    })

    ws.on(`close`, (code, reason) => {
      if (code !== 1000 && code !== 1005) {
        process.stderr.write(`Tunnel closed: ${code} ${reason?.toString() || ``}\n`)
        process.exit(1)
      }
      process.exit(0)
    })

    ws.on(`error`, (err: any) => {
      let hint = ``
      if (err.code === `ECONNREFUSED`) hint = ` Is the proxy running? Check "tsa status".`
      else if (err.code === `UNABLE_TO_VERIFY_LEAF_SIGNATURE`)
        hint = ` Try "tsa login --insecure".`
      else if (err.code === `ENOTFOUND`) hint = ` Check the proxy URL in your config.`
      process.stderr.write(`Tunnel error: ${err.message}${hint}\n`)
      process.exit(1)
    })

    ws.on(`unexpected-response`, (_req: any, res: any) => {
      const status = res?.statusCode || `unknown`
      const msg =
        status === 401 || status === 4001
          ? `Authentication failed - check your API key`
          : `Server rejected tunnel connection (${status})`
      process.stderr.write(`${msg}\n`)
      process.exit(1)
    })
  },
}
