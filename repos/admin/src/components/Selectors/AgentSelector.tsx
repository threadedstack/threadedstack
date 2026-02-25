import { useMemo } from 'react'
import { EntitySelectorSingle } from './EntitySelector'

export type TAgentSelector = {
  loading?: boolean
  disabled?: boolean
  agentId: string
  agents: Array<{ id: string; name: string }>
  onChange: (agentId: string) => void
}

export const AgentSelector = (props: TAgentSelector) => {
  const { loading, disabled, agentId, agents, onChange } = props

  const options = useMemo(
    () =>
      agents.map((a) => ({
        id: a.id,
        label: a.name || a.id,
      })),
    [agents]
  )

  return (
    <EntitySelectorSingle
      id='agent-id'
      label='Agent'
      loading={loading}
      disabled={disabled}
      value={agentId || null}
      options={options}
      onChange={(id) => onChange(id || '')}
      placeholder='Select agent...'
      description={
        loading
          ? 'Loading agents...'
          : agents.length === 0
            ? 'No agents available. Create an agent first.'
            : 'Select the AI agent to handle requests'
      }
    />
  )
}
