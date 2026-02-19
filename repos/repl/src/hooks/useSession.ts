import { useState } from 'react'
import type { TProviderInfo, TConnectionStatus } from '@TRL/types'

export function useSession() {
  const [orgId, setOrgId] = useState<string | null>(null)
  const [agentId, setAgentId] = useState<string | null>(null)
  const [threadId, setThreadId] = useState<string | null>(null)
  const [provider, setProvider] = useState<TProviderInfo | null>(null)
  const [connection, setConnection] = useState<TConnectionStatus>('disconnected')

  return {
    orgId,
    setOrgId,
    agentId,
    setAgentId,
    threadId,
    setThreadId,
    provider,
    setProvider,
    connection,
    setConnection,
  }
}
