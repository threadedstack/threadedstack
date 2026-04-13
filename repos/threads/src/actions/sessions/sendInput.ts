import { toast } from 'sonner'
import { getConnection } from './openSession'

export const sendInput = (sessionId: string, text: string): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const encoder = new TextEncoder()
  ws.send(encoder.encode(text))
  return true
}

export const sendControl = (sessionId: string, msg: Record<string, unknown>): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(msg))
  return true
}

export const approvePermission = (sessionId: string) => {
  if (!sendControl(sessionId, { type: `permission-response`, response: `y` })) {
    toast.error(`Could not send approval`, { description: `Session disconnected` })
  }
}

export const denyPermission = (sessionId: string) => {
  if (!sendControl(sessionId, { type: `permission-response`, response: `n` })) {
    toast.error(`Could not send denial`, { description: `Session disconnected` })
  }
}
