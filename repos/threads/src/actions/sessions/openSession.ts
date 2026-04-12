import type { TOpenSessionOpts } from '@TTH/types'
import type { TParsedEvent, TToolState, ESandboxSessionVisibility } from '@tdsk/domain'

import { toast } from 'sonner'
import { TerminalParser } from '@tdsk/domain'
import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import {
  getStoredSessions,
  storeSession,
  removeStoredSession,
} from '@TTH/utils/sessionStorage'
import {
  setToolState,
  setOpenSession,
  getOpenSessions,
  getActiveSession,
  setActiveSession,
  removeOpenSession,
  appendSessionEvent,
} from '@TTH/state/accessors'

const RAW_BUFFER_MAX_BYTES = 1024 * 1024

const connections = new Map<string, WebSocket>()
const parsers = new Map<string, TerminalParser>()
const rawBuffers = new Map<string, string[]>()
const terminalWriters = new Map<string, Set<(data: string) => void>>()

export const getConnection = (sessionId: string) => connections.get(sessionId)
export const getParser = (sessionId: string) => parsers.get(sessionId)
export const getRawBuffer = (sessionId: string) => rawBuffers.get(sessionId) ?? []

export const subscribeTerminalData = (sessionId: string, cb: (data: string) => void) => {
  if (!terminalWriters.has(sessionId)) terminalWriters.set(sessionId, new Set())
  terminalWriters.get(sessionId)!.add(cb)
  return () => {
    terminalWriters.get(sessionId)?.delete(cb)
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

  const ws = new WebSocket(wsUrl)
  // Use a temp key until we get the real sessionId from the server
  const tempKey = targetSessionId ?? `pending_${sandboxId}_${Date.now()}`
  connections.set(tempKey, ws)
  rawBuffers.set(tempKey, [])

  return new Promise<string>((resolve, reject) => {
    let settled = false
    let sessionId = tempKey
    ws.binaryType = `arraybuffer`

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
      const parser = new TerminalParser({
        runtime,
        onEvent: (parsedEvent: TParsedEvent) =>
          appendSessionEvent(sessionId, parsedEvent),
        onToolState: (state: TToolState) => {
          setToolState(sessionId, state)
          if (state === `permission` && getActiveSession() !== sessionId) {
            toast.warning(`Sandbox needs permission`, { duration: 5000 })
          }
        },
        debounceMs: 100,
      })
      parsers.set(sessionId, parser)

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
          return
        }

        try {
          if (msg.type === `connected` || msg.type === `joined`) {
            setupSession(msg)
            settled = true
            resolve(sessionId)
          } else if (msg.type === `reconnected`) {
            setupSession(msg)
            settled = true
            resolve(sessionId)
          } else if (msg.type === `visibility`) {
            const current = getOpenSessions()
            const existing = current.get(msg.sessionId)
            if (existing) {
              setOpenSession(msg.sessionId, {
                ...existing,
                visibility: msg.visibility,
              })
            }
          } else if (msg.type === `user-joined`) {
            toast.info(`User joined your session`, { duration: 3000 })
          } else if (msg.type === `user-left`) {
            toast.info(`User left your session`, { duration: 3000 })
          } else if (msg.type === `error`) {
            settled = true
            reject(new Error(msg.message))
          }
        } catch (err) {
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
        while (totalBytes > RAW_BUFFER_MAX_BYTES && buf.length > 1) {
          totalBytes -= buf.shift()!.length
        }
      }
      parsers.get(sessionId)?.write(data)
      terminalWriters.get(sessionId)?.forEach((cb) => cb(data))
    }

    ws.onclose = (event: CloseEvent) => {
      if (connections.get(sessionId) !== ws) return
      parsers.get(sessionId)?.flush()
      connections.delete(sessionId)
      parsers.delete(sessionId)
      rawBuffers.delete(sessionId)
      terminalWriters.delete(sessionId)

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
      if (!settled) {
        settled = true
        toast.error(`Session failed`, { description: `WebSocket connection failed` })
        reject(new Error(`WebSocket connection failed`))
      }
    }
  })
}
