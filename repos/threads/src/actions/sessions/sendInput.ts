import { toast } from 'sonner'
import { getConnection, getParser } from './openSession'

export const sendInput = (sandboxId: string, text: string): boolean => {
  const ws = getConnection(sandboxId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  const parser = getParser(sandboxId)
  parser?.trackInput(text)
  const encoder = new TextEncoder()
  ws.send(encoder.encode(text))
  return true
}

export const sendControl = (sandboxId: string, msg: Record<string, unknown>): boolean => {
  const ws = getConnection(sandboxId)
  if (!ws || ws.readyState !== WebSocket.OPEN) return false
  ws.send(JSON.stringify(msg))
  return true
}

export const approvePermission = (sandboxId: string) => {
  if (!sendInput(sandboxId, 'y\n')) {
    toast.error(`Could not send approval`, { description: `Session disconnected` })
  }
}

export const denyPermission = (sandboxId: string) => {
  if (!sendInput(sandboxId, 'n\n')) {
    toast.error(`Could not send denial`, { description: `Session disconnected` })
  }
}
