import type { TAgentInfo } from '@TRL/types'

import { Box, Text } from 'ink'
import { useEffect } from 'react'
import { themed } from '@TRL/theme'
import { SelectPrompt } from '@TRL/components/Prompt/SelectPrompt'

type TAgentPicker = {
  agents: TAgentInfo[]
  onSelect: (agent: TAgentInfo) => void
}

export const AgentPicker = (props: TAgentPicker) => {
  const { agents, onSelect } = props

  useEffect(() => {
    agents.length === 1 && onSelect(agents[0])
  }, [agents.length])

  if (agents.length === 1) return null

  const items = agents.map((a) => ({
    id: a.id,
    label: a.name,
    description: a.description,
  }))

  return (
    <Box flexDirection="column">
      <Text>{themed('bold', `You have ${agents.length} agents available.`)}</Text>
      <Text> </Text>
      <SelectPrompt
        items={items}
        prompt="Select an agent:"
        onSelect={(item) => {
          const agent = agents.find((a) => a.id === item.id)!
          onSelect(agent)
        }}
      />
    </Box>
  )
}
