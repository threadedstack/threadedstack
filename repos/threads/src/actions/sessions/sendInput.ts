import { toast } from 'sonner'
import { getConnection, getParser } from './openSession'

export const sendInput = (sessionId: string, text: string): boolean => {
  const ws = getConnection(sessionId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const parser = getParser(sessionId)
  parser?.trackInput(text)
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
  if (!sendInput(sessionId, `y\n`)) {
    toast.error(`Could not send approval`, { description: `Session disconnected` })
  }
}

export const denyPermission = (sessionId: string) => {
  if (!sendInput(sessionId, `n\n`)) {
    toast.error(`Could not send denial`, { description: `Session disconnected` })
  }
}
