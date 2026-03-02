import { useMemo } from 'react'
import { EntitySelectorSingle } from './EntitySelector'

export type TAgentSelector = {
  agentId: string
  loading?: boolean
  disabled?: boolean
  required?: boolean
  onChange: (agentId: string) => void
  agents: Array<{ id: string; name: string }>
}

export const AgentSelector = (props: TAgentSelector) => {
  const { loading, disabled, required, agentId, agents, onChange } = props

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
      options={options}
      disabled={disabled}
      required={required}
      value={agentId || null}
      placeholder='Select agent...'
      onChange={(id) => onChange(id || '')}
      description={
        loading
          ? `Loading agents...`
          : agents.length === 0
            ? `No agents available. Create an agent first.`
            : `Select the AI agent to handle requests`
      }
    />
  )
}
