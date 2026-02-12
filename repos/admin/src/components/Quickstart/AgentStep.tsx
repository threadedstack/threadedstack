import type { TAgentStepData } from '@TAF/types'

import { useState } from 'react'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import IconButton from '@mui/material/IconButton'
import { TextInput, Text } from '@tdsk/components'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

export type TAgentStep = {
  disabled?: boolean
  data: TAgentStepData
  onChange: (updates: Partial<TAgentStepData>) => void
}

export const AgentStep = (props: TAgentStep) => {
  const { data, onChange, disabled } = props
  const [showAdvanced, setShowAdvanced] = useState(false)

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 3 }}>
      <TextInput
        required
        autoFocus
        fullWidth
        disabled={disabled}
        label='Project Name'
        value={data.projectName}
        id='quickstart-project-name'
        placeholder='e.g., My AI Project'
        onChange={(e) => onChange({ projectName: e.target.value })}
      />

      <TextInput
        required
        fullWidth
        label='Agent Name'
        disabled={disabled}
        value={data.agentName}
        id='quickstart-agent-name'
        placeholder='e.g., claude-agent'
        onChange={(e) => onChange({ agentName: e.target.value })}
      />

      <TextInput
        fullWidth
        label='Description'
        disabled={disabled}
        value={data.agentDescription}
        id='quickstart-agent-description'
        placeholder='What does this agent do? (optional)'
        onChange={(e) => onChange({ agentDescription: e.target.value })}
      />

      <Box>
        <Box
          sx={{ display: `flex`, alignItems: `center`, cursor: `pointer` }}
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <Text
            variant='subtitle2'
            color='text.secondary'
          >
            Advanced
          </Text>
          <IconButton size='small'>
            <ExpandMoreIcon
              sx={{
                transition: `transform 0.2s`,
                transform: showAdvanced ? `rotate(180deg)` : `rotate(0deg)`,
              }}
            />
          </IconButton>
        </Box>
        <Collapse in={showAdvanced}>
          <Box sx={{ mt: 1 }}>
            <TextInput
              textarea
              fullWidth
              minRows={4}
              maxRows={12}
              disabled={disabled}
              label='System Prompt'
              value={data.systemPrompt}
              id='quickstart-system-prompt'
              placeholder='Instructions for the agent (optional)'
              onChange={(e) => onChange({ systemPrompt: e.target.value })}
            />
          </Box>
        </Collapse>
      </Box>
    </Box>
  )
}
