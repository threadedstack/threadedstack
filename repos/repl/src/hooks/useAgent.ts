import { useState, useCallback } from 'react'
import type { ApiClient } from '@TRL/services/api'

type TAgentInfo = {
  id: string
  name: string
  description?: string
}

export function useAgent(client: ApiClient) {
  const [agents, setAgents] = useState<TAgentInfo[]>([])
  const [currentAgent, setCurrentAgent] = useState<TAgentInfo | null>(null)
  const [loading, setLoading] = useState(false)

  const loadAgents = useCallback(
    async (orgId: string) => {
      setLoading(true)
      try {
        const list = await client.listAgents(orgId)
        setAgents(list as TAgentInfo[])
      } finally {
        setLoading(false)
      }
    },
    [client]
  )

  const selectAgent = useCallback((agent: TAgentInfo) => {
    setCurrentAgent(agent)
  }, [])

  return { agents, currentAgent, loading, loadAgents, selectAgent }
}
