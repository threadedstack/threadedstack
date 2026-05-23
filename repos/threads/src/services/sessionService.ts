import type { TTerminalEntry, TOpenSessionOpts, TSessionEventHandlers } from '@TTH/types'

import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { SandboxHomePath, EShellMsg, EContainerState } from '@tdsk/domain'
import { ConnectionTimeout, RawBufferMaxBytes } from '@TTH/constants/values'
import {
  ShellSessionsStorageKey,
  ShellSessionInstancesStorageKey,
} from '@TTH/constants/storage'

type TStoredSessions = Record<string, string[]>

export class SessionService {
  #rawBuffers = new Map<string, string[]>()
  #connections = new Map<string, WebSocket>()
  #terminals = new Map<string, TTerminalEntry>()
  #sessionSandboxMap = new Map<string, string>()
  #terminalWriters = new Map<string, Set<(data: string) => void>>()
  #engineWriters = new Map<string, Set<(data: Uint8Array) => void>>()

  getConnection(sessionId: string): WebSocket | undefined {
    return this.#connections.get(sessionId)
  }

  getRawBuffer(sessionId: string): string[] {
    return this.#rawBuffers.get(sessionId) ?? []
  }

  subscribeTerminalData(sessionId: string, cb: (data: string) => void): () => void {
    if (!this.#terminalWriters.has(sessionId))
      this.#terminalWriters.set(sessionId, new Set())
    this.#terminalWriters.get(sessionId)!.add(cb)
    return () => {
      this.#terminalWriters.get(sessionId)?.delete(cb)
    }
  }

  subscribeEngineData(sessionId: string, cb: (data: Uint8Array) => void): () => void {
    if (!this.#engineWriters.has(sessionId)) this.#engineWriters.set(sessionId, new Set())
    this.#engineWriters.get(sessionId)!.add(cb)
    return () => {
      this.#engineWriters.get(sessionId)?.delete(cb)
    }
  }

  async open(opts: TOpenSessionOpts, handlers: TSessionEventHandlers): Promise<string> {
    const { sandboxId, orgId, projectId, run = true } = opts

    let resolvedInstanceId = opts.instanceId
    if (!resolvedInstanceId && !opts.newInstance && opts.sessionId) {
      resolvedInstanceId = this.getStoredInstanceId(opts.sessionId)
      if (!resolvedInstanceId)
        resolvedInstanceId = await this.#resolveInstanceForSession(
          orgId,
          projectId,
          sandboxId,
          opts.sessionId
        )
    }

    const connectOpts = {
      ...(resolvedInstanceId ? { instanceId: resolvedInstanceId } : {}),
      ...(opts.newInstance ? { newInstance: true } : {}),
      ...(opts.sessionId ? { sessionId: opts.sessionId } : {}),
    }
    const connectResult = await sandboxApi.connect(
      orgId,
      projectId,
      sandboxId,
      connectOpts
    )
    if (connectResult.error)
      throw new Error(connectResult.error?.message ?? `Failed to connect to sandbox`)

    const subdomain = connectResult.data?.subdomain
    const shellToken = connectResult.data?.shellToken
    const instanceId = connectResult.data?.instanceId ?? ``
    const portUrlTemplate = connectResult.data?.portUrlTemplate
    const workdir = connectResult.data?.workdir ?? SandboxHomePath

    const baseUrl = new URL(apiService.base)
    const wsProto = baseUrl.protocol === `https:` ? `wss:` : `ws:`
    const cols = opts.cols ?? 80
    const rows = opts.rows ?? 24
    const params = new URLSearchParams({ cols: String(cols), rows: String(rows) })
    if (run) params.set(`run`, `true`)
    if (shellToken) params.set(`token`, shellToken)
    if (instanceId) params.set(`instanceId`, instanceId)

    let targetSessionId: string | undefined
    if (opts.sessionId === null) targetSessionId = undefined
    else if (opts.sessionId) targetSessionId = opts.sessionId
    else {
      const stored = this.getStoredSessions(sandboxId)
      targetSessionId = stored[0]
    }

    if (targetSessionId) params.set(`sessionId`, targetSessionId)

    const wsUrl = `${wsProto}//${baseUrl.host}/_/sandboxes/${sandboxId}/shell?${params}`
    const tempKey = targetSessionId ?? `pending_${sandboxId}_${Date.now()}`

    const existingWs = this.#connections.get(tempKey)
    if (existingWs) {
      if (existingWs.readyState === WebSocket.OPEN) {
        this.storeSession(sandboxId, tempKey)
        return Promise.resolve(tempKey)
      }
      try {
        existingWs.close()
      } catch (err) {
        console.warn(`[SessionService] existingWs.close() failed:`, err)
      }
      this.#cleanupSession(tempKey)
    }

    const ws = new WebSocket(wsUrl)
    this.#connections.set(tempKey, ws)
    this.#rawBuffers.set(tempKey, [])
    this.#sessionSandboxMap.set(tempKey, sandboxId)

    return new Promise<string>((resolve, reject) => {
      let settled = false
      let sessionId = tempKey
      ws.binaryType = `arraybuffer`

      const timeoutId = setTimeout(() => {
        if (!settled) {
          settled = true
          this.#cleanupSession(sessionId)
          if (tempKey !== sessionId) this.#cleanupSession(tempKey)
          this.#sessionSandboxMap.delete(sessionId)
          ws.close()
          reject(new Error(`Connection timeout`))
        }
      }, ConnectionTimeout)

      const setupSession = (msg: Record<string, any>) => {
        sessionId = msg.sessionId

        if (tempKey !== sessionId) {
          this.#cleanupSession(tempKey)
          this.#connections.set(sessionId, ws)
          this.#rawBuffers.set(sessionId, [])
        }

        this.#sessionSandboxMap.set(sessionId, sandboxId)
        this.storeSession(sandboxId, sessionId)
        this.storeInstanceId(sessionId, msg.instanceId ?? instanceId)

        handlers.onSetup({
          workdir,
          sandboxId,
          sessionId,
          projectId,
          subdomain,
          portUrlTemplate,
          threadId: msg.threadId ?? ``,
          runtime: msg.runtime ?? `custom`,
          visibility: msg.visibility ?? `private`,
          instanceId: msg.instanceId ?? instanceId,
          podOwnerUserId: msg.podOwnerUserId ?? ``,
        })
      }

      ws.onmessage = (event) => {
        if (typeof event.data === `string`) {
          let msg: Record<string, any>
          try {
            msg = JSON.parse(event.data)
          } catch {
            console.warn(
              `[SessionService] Non-JSON text from server:`,
              event.data.slice(0, 200)
            )
            return
          }

          try {
            if (msg.type === EShellMsg.Connected || msg.type === EShellMsg.Joined) {
              setupSession(msg)
              settled = true
              clearTimeout(timeoutId)
              resolve(sessionId)
            } else if (msg.type === EShellMsg.Reconnected) {
              setupSession(msg)
              settled = true
              clearTimeout(timeoutId)
              resolve(sessionId)
            } else if (msg.type === EShellMsg.Visibility) {
              handlers.onVisibilityChange?.(msg.sessionId, msg.visibility)
            } else if (msg.type === EShellMsg.UserJoined) {
              handlers.onUserJoined?.()
            } else if (msg.type === EShellMsg.UserLeft) {
              handlers.onUserLeft?.()
            } else if (msg.type === EShellMsg.SandboxStopping) {
              handlers.onSandboxStopping?.()
            } else if (msg.type === EShellMsg.SessionsUpdated) {
              if (
                msg.sandboxId &&
                Array.isArray(msg.sessions) &&
                msg.sessions.every(
                  (s: any) =>
                    s &&
                    typeof s.sessionId === `string` &&
                    typeof s.sandboxId === `string`
                )
              )
                handlers.onSessionsUpdated?.(msg.sandboxId as string, msg.sessions)
            } else if (msg.type === EShellMsg.Error) {
              clearTimeout(timeoutId)
              settled = true
              reject(new Error(msg.message))
            }
          } catch (err) {
            clearTimeout(timeoutId)
            if (!settled) {
              settled = true
              ws.close()
              this.#cleanupSession(sessionId)
              if (tempKey !== sessionId) this.#cleanupSession(tempKey)
              reject(err instanceof Error ? err : new Error(`Session setup failed`))
            }
          }
          return
        }

        const data = new TextDecoder().decode(event.data)
        const buf = this.#rawBuffers.get(sessionId)
        if (buf) {
          buf.push(data)
          let totalBytes = 0
          for (const chunk of buf) totalBytes += chunk.length
          while (totalBytes > RawBufferMaxBytes && buf.length > 1) {
            totalBytes -= buf.shift()!.length
          }
        }

        const writers = this.#terminalWriters.get(sessionId)

        if (writers && writers.size > 1)
          console.warn(
            `[SessionService] ${sessionId.slice(0, 6)}: ${writers.size} terminal writers`
          )

        writers?.forEach((cb) => cb(data))
        const rawBytes = new Uint8Array(event.data)
        this.#engineWriters.get(sessionId)?.forEach((cb) => cb(rawBytes))
      }

      ws.onclose = (event: CloseEvent) => {
        clearTimeout(timeoutId)
        if (this.#connections.get(sessionId) !== ws) return

        this.#cleanupSession(sessionId)
        if (tempKey !== sessionId) {
          this.#connections.delete(tempKey)
          this.#rawBuffers.delete(tempKey)
        }

        this.disposeTerminal(sessionId)
        this.removeStoredSession(sandboxId, sessionId)
        this.#sessionSandboxMap.delete(sessionId)

        handlers.onClose?.(sessionId, sandboxId)

        if (!settled) {
          settled = true
          reject(new Error(event.reason || `Connection closed (code ${event.code})`))
          return
        }

        if (event.code >= 4000)
          handlers.onDisconnect?.(
            sessionId,
            event.reason || `Connection closed (code ${event.code})`
          )
      }

      ws.onerror = () => {
        clearTimeout(timeoutId)
        if (!settled) {
          settled = true
          reject(new Error(`WebSocket connection failed`))
        }
      }
    })
  }

  sendInput(sessionId: string, text: string): boolean {
    const ws = this.#connections.get(sessionId)
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    const encoder = new TextEncoder()
    ws.send(encoder.encode(text))
    return true
  }

  sendControl(sessionId: string, msg: Record<string, unknown>): boolean {
    const ws = this.#connections.get(sessionId)
    if (!ws || ws.readyState !== WebSocket.OPEN) return false
    ws.send(JSON.stringify(msg))
    return true
  }

  close(sessionId: string, opts?: { preserveStorage?: boolean }): void {
    const ws = this.#connections.get(sessionId)
    this.#cleanupSession(sessionId)
    this.disposeTerminal(sessionId)

    if (!opts?.preserveStorage) {
      const sandboxId = this.#sessionSandboxMap.get(sessionId)
      if (sandboxId) this.removeStoredSession(sandboxId, sessionId)
    }
    this.#sessionSandboxMap.delete(sessionId)

    if (ws) {
      try {
        ws.close()
      } catch (err) {
        console.warn(`[SessionService] ws.close() failed for ${sessionId}:`, err)
      }
    }
  }

  closeAll(): void {
    for (const ws of this.#connections.values()) {
      try {
        ws.close()
      } catch (err) {
        console.warn(`[SessionService] ws.close() failed during closeAll:`, err)
      }
    }
    this.#connections = new Map()
    this.#rawBuffers = new Map()
    this.#terminalWriters = new Map()
    this.#engineWriters = new Map()
    this.#sessionSandboxMap = new Map()
    this.disposeAllTerminals()
  }

  getTerminal(sessionId: string): TTerminalEntry | undefined {
    return this.#terminals.get(sessionId)
  }

  setTerminal(sessionId: string, entry: TTerminalEntry): void {
    this.#terminals.set(sessionId, entry)
  }

  deleteTerminal(sessionId: string): void {
    this.#terminals.delete(sessionId)
  }

  disposeTerminal(sessionId: string): void {
    const entry = this.#terminals.get(sessionId)
    if (!entry) return
    try {
      entry.fitAddon.dispose()
    } catch (err) {
      console.warn(`[SessionService] fitAddon.dispose() failed for ${sessionId}:`, err)
    }
    try {
      entry.term.dispose()
    } catch (err) {
      console.warn(`[SessionService] term.dispose() failed for ${sessionId}:`, err)
    }
    this.#terminals.delete(sessionId)
  }

  disposeAllTerminals(): void {
    for (const entry of this.#terminals.values()) {
      try {
        entry.fitAddon.dispose()
      } catch (err) {
        console.warn(`[SessionService] fitAddon.dispose() failed:`, err)
      }
      try {
        entry.term.dispose()
      } catch (err) {
        console.warn(`[SessionService] term.dispose() failed:`, err)
      }
    }
    this.#terminals.clear()
  }

  #readStorageMap(): TStoredSessions {
    try {
      const raw = sessionStorage.getItem(ShellSessionsStorageKey)
      return raw ? JSON.parse(raw) : {}
    } catch (err) {
      console.error(`[SessionService] Stored sessions corrupted, clearing:`, err)
      sessionStorage.removeItem(ShellSessionsStorageKey)
      return {}
    }
  }

  #writeStorageMap(map: TStoredSessions): void {
    try {
      sessionStorage.setItem(ShellSessionsStorageKey, JSON.stringify(map))
    } catch (err) {
      console.warn(`[SessionService] Failed to persist session map:`, err)
    }
  }

  getStoredSessions(sandboxId: string): string[] {
    return this.#readStorageMap()[sandboxId] ?? []
  }

  storeSession(sandboxId: string, sessionId: string): void {
    this.#sessionSandboxMap.set(sessionId, sandboxId)
    const map = this.#readStorageMap()
    const list = map[sandboxId] ?? []
    if (!list.includes(sessionId)) list.push(sessionId)
    map[sandboxId] = list
    this.#writeStorageMap(map)
  }

  removeStoredSession(sandboxId: string, sessionId: string): void {
    const map = this.#readStorageMap()
    const list = (map[sandboxId] ?? []).filter((id) => id !== sessionId)
    if (list.length === 0) delete map[sandboxId]
    else map[sandboxId] = list
    this.#writeStorageMap(map)
    this.removeStoredInstanceId(sessionId)
  }

  clearStoredSessionsForSandbox(sandboxId: string): void {
    const map = this.#readStorageMap()
    const sessions = map[sandboxId] ?? []
    for (const sid of sessions) this.removeStoredInstanceId(sid)
    delete map[sandboxId]
    this.#writeStorageMap(map)
  }

  clearAllStoredSessions(): void {
    sessionStorage.removeItem(ShellSessionsStorageKey)
    sessionStorage.removeItem(ShellSessionInstancesStorageKey)
  }

  findSandboxForSession(sessionId: string): string | undefined {
    const sandboxId = this.#sessionSandboxMap.get(sessionId)
    if (sandboxId) return sandboxId

    const map = this.#readStorageMap()
    for (const [sbId, sessions] of Object.entries(map)) {
      if (sessions.includes(sessionId)) return sbId
    }
    return undefined
  }

  reset(): void {
    this.closeAll()
    this.clearAllStoredSessions()
  }

  getStoredInstanceId(sessionId: string): string | undefined {
    try {
      const raw = sessionStorage.getItem(ShellSessionInstancesStorageKey)
      const map: Record<string, string> = raw ? JSON.parse(raw) : {}
      return map[sessionId]
    } catch {
      return undefined
    }
  }

  storeInstanceId(sessionId: string, instanceId: string): void {
    try {
      const raw = sessionStorage.getItem(ShellSessionInstancesStorageKey)
      const map: Record<string, string> = raw ? JSON.parse(raw) : {}
      map[sessionId] = instanceId
      sessionStorage.setItem(ShellSessionInstancesStorageKey, JSON.stringify(map))
    } catch (err) {
      console.warn(`[SessionService] Failed to persist instanceId:`, err)
    }
  }

  removeStoredInstanceId(sessionId: string): void {
    try {
      const raw = sessionStorage.getItem(ShellSessionInstancesStorageKey)
      if (!raw) return
      const map: Record<string, string> = JSON.parse(raw)
      delete map[sessionId]
      sessionStorage.setItem(ShellSessionInstancesStorageKey, JSON.stringify(map))
    } catch (err) {
      console.warn(`[SessionService] Failed to remove stored instanceId:`, err)
    }
  }

  async #resolveInstanceForSession(
    orgId: string,
    projectId: string,
    sandboxId: string,
    sessionId: string
  ): Promise<string | undefined> {
    try {
      const result = await sandboxApi.listInstances(orgId, projectId, sandboxId)
      const instances = result.data?.instances
      if (!instances?.length) return undefined

      const running = instances.filter((i) => i.state === EContainerState.Running)
      if (!running.length) return undefined

      for (const instance of running) {
        if (instance.sessions?.some((s) => s.sessionId === sessionId))
          return instance.instanceId
      }

      return undefined
    } catch {
      return undefined
    }
  }

  #cleanupSession(sessionId: string): void {
    this.#connections.delete(sessionId)
    this.#rawBuffers.delete(sessionId)
    this.#terminalWriters.delete(sessionId)
    this.#engineWriters.delete(sessionId)
  }
}

export const sessionService = new SessionService()
