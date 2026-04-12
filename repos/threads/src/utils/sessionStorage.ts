import { ShellSessionsStorageKey } from '@TTH/constants/sessions'

type TStoredSessions = Record<string, string[]>

function readMap(): TStoredSessions {
  try {
    const raw = sessionStorage.getItem(ShellSessionsStorageKey)
    return raw ? JSON.parse(raw) : {}
  } catch (err) {
    console.warn(`[sessionStorage] Failed to parse stored sessions, resetting:`, err)
    return {}
  }
}

function writeMap(map: TStoredSessions): void {
  sessionStorage.setItem(ShellSessionsStorageKey, JSON.stringify(map))
}

export function getStoredSessions(sandboxId: string): string[] {
  return readMap()[sandboxId] ?? []
}

export function storeSession(sandboxId: string, sessionId: string): void {
  const map = readMap()
  const list = map[sandboxId] ?? []
  if (!list.includes(sessionId)) list.push(sessionId)
  map[sandboxId] = list
  writeMap(map)
}

export function removeStoredSession(sandboxId: string, sessionId: string): void {
  const map = readMap()
  const list = (map[sandboxId] ?? []).filter((id) => id !== sessionId)
  if (list.length === 0) delete map[sandboxId]
  else map[sandboxId] = list
  writeMap(map)
}

export function clearStoredSessionsForSandbox(sandboxId: string): void {
  const map = readMap()
  delete map[sandboxId]
  writeMap(map)
}

export function findSandboxForSession(sessionId: string): string | undefined {
  const map = readMap()
  for (const [sandboxId, sessions] of Object.entries(map)) {
    if (sessions.includes(sessionId)) return sandboxId
  }
  return undefined
}
