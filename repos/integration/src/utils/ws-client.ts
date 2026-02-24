import WebSocket from 'ws'
import { EWSEventType } from '@tdsk/domain'
import { env } from './env'

export interface WSMessage {
  type: string
  [key: string]: unknown
}

export interface WSResult {
  messages: WSMessage[]
  closeCode: number
  closeReason: string
}

/**
 * Connect to the WebSocket agent endpoint, send a prompt, and collect
 * all server messages until the connection closes.
 *
 * @param sessionToken - Session token from POST /_/ai/sessions
 * @param prompt - Text prompt to send
 * @param opts - Additional options
 */
export const consumeWS = (
  sessionToken: string,
  prompt: string,
  opts?: {
    threadId?: string
    maxSteps?: number
    timeout?: number
  }
): Promise<WSResult> => {
  const timeout = opts?.timeout ?? 30_000
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/ai/ws?token=${sessionToken}`

  return new Promise<WSResult>((resolve) => {
    const messages: WSMessage[] = []
    let closeCode = 0
    let closeReason = ''
    let timer: ReturnType<typeof setTimeout> | null = null

    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false })

    const cleanup = () => {
      if (timer) clearTimeout(timer)
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }

    timer = setTimeout(() => {
      cleanup()
      resolve({ messages, closeCode: -1, closeReason: 'timeout' })
    }, timeout)

    ws.on('open', () => {
      ws.send(
        JSON.stringify({
          type: EWSEventType.Prompt,
          prompt,
          ...(opts?.threadId ? { threadId: opts.threadId } : {}),
          ...(opts?.maxSteps ? { maxSteps: opts.maxSteps } : {}),
        })
      )
    })

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as WSMessage
        messages.push(msg)

        // Close after receiving 'done' to mirror real client behavior
        if (msg.type === EWSEventType.Done) {
          ws.close()
        }
      } catch {
        // Non-JSON message — skip
      }
    })

    ws.on('close', (code: number, reason: Buffer) => {
      closeCode = code
      closeReason = reason.toString('utf8')
      if (timer) clearTimeout(timer)
      resolve({ messages, closeCode, closeReason })
    })

    ws.on('error', () => {
      if (timer) clearTimeout(timer)
      resolve({ messages, closeCode: -2, closeReason: 'connection_error' })
    })
  })
}

/**
 * Attempt a WebSocket connection and return the close code/reason
 * without sending any messages. Useful for auth rejection tests.
 *
 * Note: The WS handshake completes at the HTTP level through Caddy→Proxy→Backend,
 * so `opened` will be true even for invalid tokens. The backend validates the token
 * AFTER the upgrade and closes with 4001 for invalid sessions. Use `closeCode` to
 * determine whether the connection was truly accepted.
 */
/**
 * Create a raw WebSocket connection with session token.
 * Returns the WebSocket instance for fine-grained control (cancel, concurrent tests).
 * Caller is responsible for closing the connection.
 */
export const createWSConnection = (
  sessionToken: string,
  opts?: { timeout?: number }
): Promise<{ ws: WebSocket; messages: WSMessage[]; waitForClose: () => Promise<{ closeCode: number; closeReason: string }> }> => {
  const timeout = opts?.timeout ?? 30_000
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/ai/ws?token=${sessionToken}`

  return new Promise((resolve, reject) => {
    const messages: WSMessage[] = []
    let closeResolve: ((val: { closeCode: number; closeReason: string }) => void) | null = null
    let timer: ReturnType<typeof setTimeout> | null = null

    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false })

    timer = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
    }, timeout)

    ws.on('open', () => {
      if (timer) clearTimeout(timer)
      resolve({
        ws,
        messages,
        waitForClose: () => new Promise<{ closeCode: number; closeReason: string }>((res) => {
          if (ws.readyState === WebSocket.CLOSED) {
            res({ closeCode: 0, closeReason: '' })
            return
          }
          closeResolve = res
        }),
      })
    })

    ws.on('message', (raw: Buffer | string) => {
      try {
        const msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString('utf8')) as WSMessage
        messages.push(msg)
      } catch {
        // Non-JSON message — skip
      }
    })

    ws.on('close', (code: number, reason: Buffer) => {
      if (timer) clearTimeout(timer)
      closeResolve?.({ closeCode: code, closeReason: reason.toString('utf8') })
    })

    ws.on('error', (err) => {
      if (timer) clearTimeout(timer)
      reject(err)
    })
  })
}

export const connectWS = (
  tokenQueryParam: string | null,
  opts?: { timeout?: number }
): Promise<{ closeCode: number; closeReason: string; opened: boolean }> => {
  const timeout = opts?.timeout ?? 10_000
  const tokenSuffix = tokenQueryParam !== null ? `?token=${tokenQueryParam}` : ''
  const wsUrl = `${env.proxyUrl.replace(/^http/, 'ws')}/ai/ws${tokenSuffix}`

  return new Promise((resolve) => {
    let opened = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const ws = new WebSocket(wsUrl, { rejectUnauthorized: false })

    timer = setTimeout(() => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close()
      }
      resolve({ closeCode: -1, closeReason: 'timeout', opened })
    }, timeout)

    ws.on('open', () => {
      opened = true
      // Don't close immediately — wait for server-side validation.
      // The backend checks the token and closes with 4001 for invalid sessions.
    })

    ws.on('close', (code: number, reason: Buffer) => {
      if (timer) clearTimeout(timer)
      resolve({ closeCode: code, closeReason: reason.toString('utf8'), opened })
    })

    ws.on('error', () => {
      if (timer) clearTimeout(timer)
      resolve({ closeCode: -2, closeReason: 'connection_error', opened })
    })
  })
}
