import type { TOpenSessionOpts } from '@TTH/types'
import type { ESandboxSessionVisibility } from '@tdsk/domain'

import { toast } from 'sonner'
import { EShellMsg } from '@tdsk/domain'
import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import { ConnectionTimeout, RawBufferMaxBytes } from '@TTH/constants/values'
import {
  storeSession,
  getStoredSessions,
  removeStoredSession,
} from '@TTH/utils/sessionStorage'
import {
  setOpenSession,
  getOpenSessions,
  getActiveSession,
  setActiveSession,
  removeOpenSession,
} from '@TTH/state/accessors'

let rawBuffers = new Map<string, string[]>()
let connections = new Map<string, WebSocket>()
let terminalWriters = new Map<string, Set<(data: string) => void>>()
let engineWriters = new Map<string, Set<(data: Uint8Array) => void>>()

export const getConnection = (sessionId: string) => connections.get(sessionId)
export const getRawBuffer = (sessionId: string) => rawBuffers.get(sessionId) ?? []

export const subscribeTerminalData = (sessionId: string, cb: (data: string) => void) => {
  if (!terminalWriters.has(sessionId)) terminalWriters.set(sessionId, new Set())
  terminalWriters.get(sessionId)!.add(cb)
  return () => {
    terminalWriters.get(sessionId)?.delete(cb)
  }
}

export const subscribeEngineData = (
  sessionId: string,
  cb: (data: Uint8Array) => void
) => {
  if (!engineWriters.has(sessionId)) engineWriters.set(sessionId, new Set())
  engineWriters.get(sessionId)!.add(cb)
  return () => {
    engineWriters.get(sessionId)?.delete(cb)
  }
}

export const openSession = async (opts: TOpenSessionOpts) => {
  const { sandboxId, orgId, projectId, run = true } = opts

  const connectResult = await sandboxApi.connect(orgId, projectId, sandboxId)
  if (connectResult.error)
    throw new Error(connectResult.error?.message ?? `Failed to connect to sandbox`)

  const shellToken = connectResult.data?.shellToken
  const podName = connectResult.data?.podName ?? ``

  const baseUrl = new URL(apiService.base)
  const wsProto = baseUrl.protocol === `https:` ? `wss:` : `ws:`
  const params = new URLSearchParams({ cols: `80`, rows: `24` })
  if (run) params.set(`run`, `true`)
  if (shellToken) params.set(`token`, shellToken)

  // Resolve session intent
  let targetSessionId: string | undefined
  if (opts.sessionId === null) {
    targetSessionId = undefined
  } else if (opts.sessionId) {
    targetSessionId = opts.sessionId
  } else {
    const stored = getStoredSessions(sandboxId)
    targetSessionId = stored[0]
  }
  if (targetSessionId) params.set(`sessionId`, targetSessionId)

  const wsUrl = `${wsProto}//${baseUrl.host}/_/sandboxes/${sandboxId}/shell?${params}`

  const tempKey = targetSessionId ?? `pending_${sandboxId}_${Date.now()}`

  const existingWs = connections.get(tempKey)
  if (existingWs) {
    if (existingWs.readyState === WebSocket.OPEN) {
      setActiveSession(tempKey)
      storeSession(sandboxId, tempKey)
      return Promise.resolve(tempKey)
    }
    try {
      existingWs.close()
    } catch {
      /* already closed */
    }
    connections.delete(tempKey)
    rawBuffers.delete(tempKey)
    terminalWriters.delete(tempKey)
    engineWriters.delete(tempKey)
  }

  const ws = new WebSocket(wsUrl)
  connections.set(tempKey, ws)
  rawBuffers.set(tempKey, [])

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let sessionId = tempKey
    ws.binaryType = `arraybuffer`

    const timeoutId = setTimeout(() => {
      if (!settled) {
        settled = true
        ws.close()
        reject(new Error(`Connection timeout`))
      }
    }, ConnectionTimeout)

    const setupSession = (msg: Record<string, any>) => {
      sessionId = msg.sessionId

      // Migrate from temp key to real sessionId
      if (tempKey !== sessionId) {
        connections.delete(tempKey)
        rawBuffers.delete(tempKey)
        connections.set(sessionId, ws)
        rawBuffers.set(sessionId, [])
      }

      const runtime = msg.runtime ?? `custom`

      setOpenSession(sessionId, {
        sandboxId,
        sessionId,
        threadId: msg.threadId ?? ``,
        runtime,
        projectId,
        podName: msg.podName ?? podName,
        podOwnerUserId: msg.podOwnerUserId ?? ``,
        visibility: (msg.visibility ?? `private`) as ESandboxSessionVisibility,
      })
      setActiveSession(sessionId)
      storeSession(sandboxId, sessionId)
    }

    ws.onmessage = (event) => {
      if (typeof event.data === `string`) {
        let msg: Record<string, any>
        try {
          msg = JSON.parse(event.data)
        } catch {
          console.warn(`[Session] Non-JSON text from server:`, event.data.slice(0, 200))
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
            const current = getOpenSessions()
            const existing = current.get(msg.sessionId)
            if (existing) {
              setOpenSession(msg.sessionId, {
                ...existing,
                visibility: msg.visibility,
              })
            }
          } else if (msg.type === EShellMsg.UserJoined) {
            toast.info(`User joined your session`, { duration: 3000 })
          } else if (msg.type === EShellMsg.UserLeft) {
            toast.info(`User left your session`, { duration: 3000 })
          } else if (msg.type === EShellMsg.SandboxStopping) {
            toast.info(`Sandbox is being stopped by another user`, { duration: 5000 })
          } else if (msg.type === EShellMsg.Error) {
            clearTimeout(timeoutId)
            settled = true
            reject(new Error(msg.message))
          }
        } catch (err) {
          clearTimeout(timeoutId)
          settled = true
          reject(err instanceof Error ? err : new Error(`Session setup failed`))
        }
        return
      }

      const data = new TextDecoder().decode(event.data)
      const buf = rawBuffers.get(sessionId)
      if (buf) {
        buf.push(data)
        let totalBytes = 0
        for (const chunk of buf) totalBytes += chunk.length
        while (totalBytes > RawBufferMaxBytes && buf.length > 1) {
          totalBytes -= buf.shift()!.length
        }
      }
      terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
      const rawBytes = new Uint8Array(event.data)
      engineWriters.get(sessionId)?.forEach((cb) => cb(rawBytes))
    }

    ws.onclose = (event: CloseEvent) => {
      clearTimeout(timeoutId)
      if (connections.get(sessionId) !== ws) return
      connections.delete(sessionId)
      rawBuffers.delete(sessionId)
      terminalWriters.delete(sessionId)
      engineWriters.delete(sessionId)

      // Also clean temp key if still present
      if (tempKey !== sessionId) {
        connections.delete(tempKey)
        rawBuffers.delete(tempKey)
      }

      const session = getOpenSessions().get(sessionId)
      if (session) {
        removeOpenSession(sessionId)
        removeStoredSession(sandboxId, sessionId)
      }
      if (getActiveSession() === sessionId) {
        setActiveSession(null)
      }
      if (!settled) {
        settled = true
        const reason = event.reason || `Connection closed (code ${event.code})`
        toast.error(`Session failed`, { description: reason })
        reject(new Error(reason))
        return
      }
      if (event.code >= 4000) {
        toast.error(`Session disconnected`, {
          description: event.reason || `Connection closed (code ${event.code})`,
        })
      }
    }

    ws.onerror = () => {
      clearTimeout(timeoutId)
      if (!settled) {
        settled = true
        toast.error(`Session failed`, {
          description: `Could not connect to ${baseUrl.host}`,
        })
        reject(new Error(`WebSocket connection failed`))
      }
    }
  })
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    for (const ws of connections.values()) {
      try {
        ws.close()
      } catch {
        /* already closed */
      }
    }
    rawBuffers = new Map()
    connections = new Map()
    engineWriters = new Map()
    terminalWriters = new Map()
  })
}
