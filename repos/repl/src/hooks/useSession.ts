import { useState } from 'react'
import type { TConnectionStatus } from '@TRL/types'

export function useSession() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [connection, setConnection] = useState<TConnectionStatus>('disconnected')

  return {
    orgId,
    setOrgId,
    agentId,
    setAgentId,
    threadId,
    setThreadId,
    connection,
    setConnection,
  }
}
