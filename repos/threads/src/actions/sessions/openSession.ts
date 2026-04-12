import type { TOpenSessionOpts } from '@TTH/types'
import type { TParsedEvent, TToolState } from '@tdsk/domain'

import { toast } from 'sonner'
import { TerminalParser } from '@tdsk/domain'
import { apiService } from '@TTH/services/api'
import { sandboxApi } from '@TTH/services/sandboxApi'
import {
  setToolState,
  setOpenSession,
  getActiveSession,
  setActiveSession,
  removeOpenSession,
  appendSessionEvent,
} from '@TTH/state/accessors'

const RAW_BUFFER_MAX_BYTES = 1024 * 1024 // 1MB

const connections = new Map<string, WebSocket>()
const parsers = new Map<string, TerminalParser>()
const rawBuffers = new Map<string, string[]>()
const terminalWriters = new Map<string, Set<(data: string) => void>>()

export const getConnection = (sandboxId: string) => connections.get(sandboxId)
export const getParser = (sandboxId: string) => parsers.get(sandboxId)
export const getRawBuffer = (sandboxId: string) => rawBuffers.get(sandboxId) ?? []

export const subscribeTerminalData = (sandboxId: string, cb: (data: string) => void) => {
  if (!terminalWriters.has(sandboxId)) terminalWriters.set(sandboxId, new Set())
  terminalWriters.get(sandboxId)!.add(cb)
  return () => {
    terminalWriters.get(sandboxId)?.delete(cb)
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
  const params = new URLSearchParams({ cols: '80', rows: '24' })
  if (run) params.set(`run`, `true`)
  if (shellToken) params.set(`token`, shellToken)

  const storedSessionId =
    opts.reconnectSessionId !== null
      ? (opts.reconnectSessionId ?? sessionStorage.getItem(`shell_${sandboxId}`))
      : undefined
  if (storedSessionId) params.set('sessionId', storedSessionId)

  const wsUrl = `${wsProto}//${baseUrl.host}/_/sandboxes/${sandboxId}/shell?${params}`

  const ws = new WebSocket(wsUrl)
  connections.set(sandboxId, ws)
  rawBuffers.set(sandboxId, [])

  return new Promise<void>((resolve, reject) => {
    let settled = false
    ws.binaryType = `arraybuffer`

    ws.onmessage = (event) => {
      if (typeof event.data === `string`) {
        let msg: Record<string, any>
        try {
          msg = JSON.parse(event.data)
        } catch {
          console.warn(`[Shell] Received non-JSON text frame:`, event.data)
          return
        }

        try {
          if (msg.type === `connected` || msg.type === `reconnected`) {
            sessionStorage.setItem(`shell_${sandboxId}`, msg.sessionId)

            const runtime = msg.runtime ?? `custom`
            const parser = new TerminalParser({
              runtime,
              onEvent: (parsedEvent: TParsedEvent) =>
                appendSessionEvent(sandboxId, parsedEvent),
              onToolState: (state: TToolState) => {
                setToolState(sandboxId, state)
                if (state === `permission` && getActiveSession() !== sandboxId) {
                  toast.warning(`Sandbox needs permission`, { duration: 5000 })
                }
              },
              debounceMs: 100,
            })
            parsers.set(sandboxId, parser)

            setOpenSession(sandboxId, {
              sandboxId,
              sessionId: msg.sessionId,
              threadId: msg.threadId ?? ``,
              runtime,
              projectId,
              podName,
            })
            setActiveSession(sandboxId)
            settled = true
            resolve()
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
      const buf = rawBuffers.get(sandboxId)
      if (buf) {
        buf.push(data)
        let totalBytes = 0
        for (const chunk of buf) totalBytes += chunk.length
        while (totalBytes > RAW_BUFFER_MAX_BYTES && buf.length > 1) {
          totalBytes -= buf.shift()!.length
        }
      }
      parsers.get(sandboxId)?.write(data)
      terminalWriters.get(sandboxId)?.forEach((cb) => cb(data))
    }

    ws.onclose = (event: CloseEvent) => {
      if (connections.get(sandboxId) !== ws) return
      parsers.get(sandboxId)?.flush()
      connections.delete(sandboxId)
      parsers.delete(sandboxId)
      rawBuffers.delete(sandboxId)
      terminalWriters.delete(sandboxId)
      removeOpenSession(sandboxId)
      if (getActiveSession() === sandboxId) {
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
        reject(new Error('WebSocket connection failed'))
      }
    }
  })
}
