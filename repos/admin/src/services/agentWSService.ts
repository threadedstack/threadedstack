import type { TWSClientMsg, TWSServerMsg } from '@tdsk/domain'

import { apiUrl } from '@TAF/utils/api/apiUrl'
import { agentsApi } from '@TAF/services/agentsApi'

export type TAgentWSState = `disconnected` | `connecting` | `connected` | `error`

export type TAgentWSCallbacks = {
  onEvent: (msg: TWSServerMsg) => void
  onStateChange: (state: TAgentWSState) => void
  onError: (message: string) => void
}

export type TAgentWSServiceOpts = {
  orgId: string
  agentId: string
}

/**
 * Manages the WebSocket lifecycle for agent chat sessions.
 * Handles session creation, WS connect/close/reconnect, and event routing.
 * Designed to be owned by a React hook but contains no React dependencies.
 */
export class AgentWSService {
  #disposed = false
  #opts: TAgentWSServiceOpts
  #ws: WebSocket | null = null
  #sessionCreatedAt: number = 0
  #sessionToken: string | null = null
  #state: TAgentWSState = `disconnected`
  #callbacks: TAgentWSCallbacks | null = null

  /** Create a fresh session after 50min of the 60min backend TTL */
  static SessionRenewMS = 50 * 60 * 1000

  constructor(opts: TAgentWSServiceOpts) {
    this.#opts = opts
  }

  get state() {
    return this.#state
  }

  get isConnected() {
    return this.#state === `connected`
  }

  setCallbacks(cbs: TAgentWSCallbacks) {
    this.#callbacks = cbs
  }

  /**
   * Ensure a valid session exists and the WS is open.
   * Creates a new session if missing or near-expiry, then opens a WS if needed.
   * Returns true when the connection is ready to send messages.
   */
  async ensureConnection(): Promise<boolean> {
    if (this.#disposed) return false

    const sessionAge = Date.now() - this.#sessionCreatedAt
    const needsNewSession =
      !this.#sessionToken || sessionAge > AgentWSService.SessionRenewMS

    if (needsNewSession) {
      const { data, error } = await agentsApi.createSession(
        this.#opts.orgId,
        this.#opts.agentId
      )

      if (error || !data) {
        this.#callbacks?.onError(error?.message || `Failed to create session`)
        return false
      }

      this.#sessionToken = data.sessionToken
      this.#sessionCreatedAt = Date.now()

      // Session changed — close stale WS so a fresh one is opened below
      this.#closeWS()
    }

    if (this.#disposed) return false

    // WS already open and healthy — reuse it
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) return true

    // Open a new WS connection
    this.#setState(`connecting`)

    return new Promise<boolean>((resolve) => {
      const base = apiUrl({}).replace(/\/$/, ``).replace(/^http/, `ws`)
      const wsUrl = `${base}/ai/ws?token=${this.#sessionToken}`
      const ws = new WebSocket(wsUrl)
      this.#ws = ws

      ws.onopen = () => {
        if (this.#disposed) {
          ws.close()
          resolve(false)
          return
        }

        this.#setState(`connected`)
        resolve(true)
      }

      ws.onmessage = (event: MessageEvent) => {
        let msg: TWSServerMsg
        try {
          msg = JSON.parse(event.data as string) as TWSServerMsg
        } catch {
          console.error(`[Websocket] Received malformed message`, event.data)
          return
        }

        try {
          this.#callbacks?.onEvent(msg)
        } catch (err) {
          console.error(`[Websocket] Error in event handler`, err)
        }
      }

      ws.onclose = () => {
        this.#ws = null
        if (!this.#disposed) this.#setState(`disconnected`)
      }

      ws.onerror = () => {
        this.#callbacks?.onError(`WebSocket connection error`)
        if (!this.#disposed) this.#setState(`error`)
        resolve(false)
      }
    })
  }

  /**
   * Send a typed client message over the open WS.
   * Returns false if the socket isn't open.
   */
  send(msg: TWSClientMsg): boolean {
    if (!this.#ws || this.#ws.readyState !== WebSocket.OPEN) return false
    this.#ws.send(JSON.stringify(msg))
    return true
  }

  /**
   * Close the WS connection and clear the session.
   * A subsequent `ensureConnection()` call will create a fresh session + WS.
   */
  close() {
    this.#closeWS()
    this.#sessionToken = null
    this.#sessionCreatedAt = 0
  }

  /**
   * Full teardown — call on hook unmount.
   * Prevents any further callbacks from firing.
   */
  dispose() {
    this.#disposed = true
    this.close()
    this.#callbacks = null
  }

  #closeWS() {
    if (!this.#ws) return

    // Null out handlers before closing to prevent ghost callbacks
    this.#ws.onopen = null
    this.#ws.onmessage = null
    this.#ws.onclose = null
    this.#ws.onerror = null
    this.#ws.close()
    this.#ws = null
  }

  #setState(state: TAgentWSState) {
    this.#state = state
    this.#callbacks?.onStateChange(state)
  }
}
