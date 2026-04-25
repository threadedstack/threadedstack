import { useSandboxSessions } from '@TTH/hooks/sandbox/useSandboxSessions'

export const useSandboxHasSession = (sandboxId: string): boolean => {
  const sessions = useSandboxSessions(sandboxId)
  return sessions.length > 0
}
