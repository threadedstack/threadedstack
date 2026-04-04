import type { TTask } from '@TRL/types'

import WebSocket from 'ws'

/**
 * ProxyCommand transport for SSH tunneling.
 * Called by SSH client, NOT by user directly.
 * Bridges stdin/stdout <-> WebSocket binary frames to backend tunnel endpoint.
 */
export const proxy: TTask = {
  name: `proxy`,
  alias: [],
  description: `SSH ProxyCommand transport (internal)`,
  example: `tsa proxy <sandbox-id>`,
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

    ws.on(`open`, () => {
      process.stdin.on(`data`, (chunk: Buffer) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(chunk)
        }
      })

      process.stdin.on(`end`, () => {
        ws.close()
      })

      ws.on(`message`, (data: Buffer) => {
        process.stdout.write(data)
      })
    })

    ws.on(`close`, (code, reason) => {
      if (code !== 1000 && code !== 1005) {
        process.stderr.write(`Tunnel closed: ${code} ${reason?.toString() || ``}\n`)
      }
      process.exit(0)
    })

    ws.on(`error`, (err) => {
      process.stderr.write(`Tunnel error: ${err.message}\n`)
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

    process.stdin.resume()
  },
}
