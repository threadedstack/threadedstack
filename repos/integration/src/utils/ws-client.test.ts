import net from 'node:net'
import { WebSocketServer } from 'ws'
import { describe, test, expect, afterEach } from 'vitest'
import { createWSConnection } from './ws-client'

/**
 * Unit tests for createWSConnection()'s timeout/settlement behavior.
 *
 * Uses local raw servers instead of a live backend so these run without
 * K8s/proxy infrastructure.
 */
describe(`createWSConnection`, () => {
  let closeServer: (() => void) | null = null

  afterEach(() => {
    closeServer?.()
    closeServer = null
    delete process.env.TDSK_IT_PROXY_URL
  })

  test(`rejects within the configured timeout when the WS handshake never completes`, async () => {
    // A raw TCP server that accepts the connection but never responds to the
    // WS upgrade request — 'open' and 'error' never fire on the client,
    // reproducing a stalled handshake (the exact scenario the timeout guards).
    const server = net.createServer((socket) => {
      socket.on(`error`, () => {})
    })
    await new Promise<void>((resolve) => server.listen(0, `127.0.0.1`, resolve))
    closeServer = () => server.close()

    const { port } = server.address() as net.AddressInfo
    process.env.TDSK_IT_PROXY_URL = `http://127.0.0.1:${port}`

    const start = Date.now()
    await expect(createWSConnection(`test-token`, { timeout: 200 })).rejects.toThrow(
      /timed out after 200ms/
    )
    // Rejects near the configured timeout, not the vitest global 120s timeout.
    expect(Date.now() - start).toBeLessThan(2_000)
  })

  test(`resolves normally when the WS handshake succeeds`, async () => {
    const wss = new WebSocketServer({ host: `127.0.0.1`, port: 0 })
    closeServer = () => wss.close()
    await new Promise<void>((resolve) => wss.once(`listening`, resolve))

    const { port } = wss.address() as net.AddressInfo
    process.env.TDSK_IT_PROXY_URL = `http://127.0.0.1:${port}`

    const { ws, waitForClose } = await createWSConnection(`test-token`, { timeout: 5_000 })
    expect(ws.readyState).toBe(ws.OPEN)

    ws.close()
    await waitForClose()
  })
})
