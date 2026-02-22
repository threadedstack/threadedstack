import { Box, Text } from 'ink'
import { useEffect } from 'react'
import { themed } from '@TRL/theme'
import { SelectPrompt } from '@TRL/components/Prompt/SelectPrompt'

type TProjectInfo = {
  id: string
  name: string
  description?: string
}

type TProjectPicker = {
  projects: TProjectInfo[]
  onSelect: (project: TProjectInfo) => void
}

export const ProjectPicker = (props: TProjectPicker) => {
  const { projects, onSelect } = props

  useEffect(() => {
    projects.length === 1 && onSelect(projects[0])
  }, [projects.length])

  if (projects.length === 1) return null

  const items = projects.map((p) => ({
    id: p.id,
    label: p.name || p.id,
    description: p.description,
  }))

  return (
    <Box flexDirection="column">
      <Text>{themed('bold', `You have ${projects.length} projects available.`)}</Text>
      <Text> </Text>
      <SelectPrompt
        items={items}
        prompt="Select a project:"
        onSelect={(item) => {
          const project = projects.find((p) => p.id === item.id)!
          onSelect(project)
        }}
      />
    </Box>
  )
}
