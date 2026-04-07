import type { TWSServerMsg } from '@tdsk/domain'
import type { ApiClient } from '@TRL/services/api'
import type { TExecRunOpts, TSessionInfo, TRunResult } from '@TRL/types'

import WebSocket from 'ws'
import { EWSEventType, EStreamEventType, EStreamStopReason } from '@tdsk/domain'

/**
 * Executor — thin WebSocket client that connects to backend for agent execution.
 *
 * Flow:
 * 1. Creates a session via HTTP (backend resolves API key, returns session token)
 * 2. Connects to WebSocket with session token
 * 3. Sends prompt message
 * 4. Receives streaming events and forwards them via onEvent callback
 */
export class Executor {
  #client: ApiClient
  #cachedSession: {
    session: TSessionInfo
    agentId: string
    providerId?: string
    createdAt: number
  } | null = null
  static SESSION_TTL_MS = 55 * 60 * 1000 // 55 minutes (server expires at 60)
  #ws: WebSocket | null = null

  constructor(client: ApiClient) {
    this.#client = client
  }

  get client(): ApiClient {
    return this.#client
  }

  async createSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    const { data: session, error } = await this.#client.createSession(agentId, providerId)
    if (error || !session)
      throw new Error(`Failed to create session: ${error?.message || `unknown error`}`)
    return session
  }

  async #ensureSession(agentId: string, providerId?: string): Promise<TSessionInfo> {
    if (
      this.#cachedSession &&
      this.#cachedSession.agentId === agentId &&
      this.#cachedSession.providerId === providerId &&
      Date.now() - this.#cachedSession.createdAt < Executor.SESSION_TTL_MS
    ) {
      return this.#cachedSession.session
    }
    const session = await this.createSession(agentId, providerId)
    this.#cachedSession = { session, agentId, providerId, createdAt: Date.now() }
    return session
  }

  clearSession(): void {
    this.#cachedSession = null
  }

  abort(): void {
    if (this.#ws) {
      this.#ws.close()
      this.#ws = null
    }
  }

  destroy(): void {
    this.abort()
    this.clearSession()
  }

  async run(opts: TExecRunOpts): Promise<TRunResult> {
    const { agentId, prompt, onEvent } = opts

    // 1. Get or reuse session
    const session = await this.#ensureSession(agentId, opts.providerId)

    // 2. Build WS URL with session token
    const baseUrl = this.#client.proxyUrl.replace(/^http/, `ws`)
    const wsUrl = `${baseUrl}/ai/ws?token=${session.sessionToken}`

    // 3. Build final prompt with optional context files
    let finalPrompt = prompt
    if (opts.contextFiles?.length) {
      const contextBlock = opts.contextFiles
        .map((f) => `--- ${f.name} ---\n${f.content}`)
        .join(`\n\n`)
      finalPrompt = `<context>\n${contextBlock}\n</context>\n\n${prompt}`
    }

    // 4. Connect and run
    return new Promise<TRunResult>((resolve, reject) => {
      let threadId = opts.threadId
      let resolved = false
      const ws = new WebSocket(wsUrl, {
        rejectUnauthorized: false,
      })
      this.#ws = ws

      ws.on(`open`, () => {
        ws.send(
          JSON.stringify({
            type: EWSEventType.Prompt,
            prompt: finalPrompt,
            threadId,
            maxSteps: opts.maxSteps,
          })
        )
      })

      ws.on(`message`, (raw: Buffer | string) => {
        let msg: TWSServerMsg
        try {
          msg = JSON.parse(
            typeof raw === `string` ? raw : raw.toString(`utf8`)
          ) as TWSServerMsg
        } catch (e) {
          console.error(`[Executor] Failed to parse WS message:`, e)
          return
        }

        switch (msg.type) {
          case EWSEventType.TextDelta:
            onEvent({ type: EStreamEventType.text, text: msg.delta })
            break

          case EWSEventType.ToolExecutionStart:
            onEvent({
              type: EStreamEventType.toolCallStart,
              id: msg.toolCallId,
              name: msg.toolName,
            })
            break

          case EWSEventType.ToolExecutionEnd:
            onEvent({
              type: EStreamEventType.toolResult,
              toolUseId: msg.toolCallId,
              content: msg.result,
              isError: msg.isError,
            })
            break

          case EWSEventType.ToolExecutionUpdate:
            onEvent({
              type: EStreamEventType.toolExecutionUpdate,
              toolUseId: msg.toolCallId,
              content: msg.result,
            })
            break

          case EWSEventType.ThreadCreated:
            threadId = msg.threadId
            break

          case EWSEventType.TurnEnd:
            onEvent({
              type: EStreamEventType.turnEnd,
              usage: msg.usage,
            })
            break

          case EWSEventType.Done:
            onEvent({
              type: EStreamEventType.done,
              stopReason:
                msg.reason === `error`
                  ? EStreamStopReason.error
                  : EStreamStopReason.endTurn,
            })
            resolved = true
            resolve({ threadId: threadId || `` })
            ws.close()
            break

          case EWSEventType.Error:
            onEvent({ type: EStreamEventType.error, error: msg.message })
            break

          case EWSEventType.FileRequest:
            break

          case EWSEventType.FileChanged:
            break

          case EWSEventType.Ping:
            break
        }
      })

      ws.on(`close`, (code: number) => {
        this.#ws = null
        if (code === 4001) this.clearSession()
        if (resolved) return
        if (code >= 4000 || code === 1011) {
          reject(new Error(`WebSocket closed with code ${code}`))
          return
        }
        resolve({ threadId: threadId || `` })
      })

      ws.on(`error`, (err: Error) => {
        this.#ws = null
        reject(err)
      })
    })
  }
}
