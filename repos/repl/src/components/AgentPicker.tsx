import React, { useEffect } from 'react'
import { Box, Text } from 'ink'
import { SelectPrompt } from './SelectPrompt'
import { themed } from '@TRL/theme'

type TAgentInfo = {
  id: string
  name: string
  description?: string
}

type Props = {
  agents: TAgentInfo[]
  onSelect: (agent: TAgentInfo) => void
}

export function AgentPicker({ agents, onSelect }: Props) {
  useEffect(() => {
    if (agents.length === 1) {
      onSelect(agents[0])
    }
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
