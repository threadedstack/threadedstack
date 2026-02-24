import type { TAgentStepData } from '@TAF/types'

import { useState } from 'react'
import { styled, alpha } from '@mui/material/styles'
import { TextInput, Text } from '@tdsk/components'
import Box from '@mui/material/Box'
import Collapse from '@mui/material/Collapse'
import Typography from '@mui/material/Typography'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import TuneIcon from '@mui/icons-material/Tune'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'

const SectionHeader = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  marginBottom: theme.spacing(1.5),
}))

const SectionIcon = styled(Box)(({ theme }) => ({
  width: 28,
  height: 28,
  display: `flex`,
  alignItems: `center`,
  justifyContent: `center`,
  borderRadius: theme.spacing(0.75),
  backgroundColor: alpha(theme.palette.primary.main, 0.1),
  color: theme.palette.primary.main,
}))

const FormSection = styled(Box)(({ theme }) => ({
  display: `flex`,
  flexDirection: `column`,
  gap: theme.spacing(2.5),
  padding: theme.spacing(2.5),
  borderRadius: theme.spacing(1.5),
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
}))

const AdvancedToggle = styled(Box)(({ theme }) => ({
  display: `flex`,
  alignItems: `center`,
  gap: theme.spacing(1),
  cursor: `pointer`,
  padding: theme.spacing(1, 1.5),
  borderRadius: theme.spacing(1),
  transition: `background-color 0.15s ease`,
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, 0.04),
  },
}))

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
      <Box>
        <SectionHeader>
          <SectionIcon>
            <AccountTreeIcon sx={{ fontSize: 16 }} />
          </SectionIcon>
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 600, letterSpacing: `0.02em` }}
          >
            Project
          </Typography>
        </SectionHeader>
        <FormSection>
          <TextInput
            required
            autoFocus
            fullWidth
            disabled={disabled}
            label='Project Name'
            value={data.projectName}
            id='quickstart-project-name'
            sx={{ bgcolor: `background.paper` }}
            placeholder='e.g., My AI Project'
            onChange={(e) => onChange({ projectName: e.target.value })}
          />
        </FormSection>
      </Box>

      <Box>
        <SectionHeader>
          <SectionIcon>
            <SmartToyOutlinedIcon sx={{ fontSize: 16 }} />
          </SectionIcon>
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 600, letterSpacing: `0.02em` }}
          >
            Agent
          </Typography>
        </SectionHeader>
        <FormSection>
          <TextInput
            required
            fullWidth
            label='Agent Name'
            disabled={disabled}
            value={data.agentName}
            id='quickstart-agent-name'
            sx={{ bgcolor: `background.paper` }}
            placeholder='e.g., claude-agent'
            onChange={(e) => onChange({ agentName: e.target.value })}
          />

          <TextInput
            fullWidth
            label='Description'
            disabled={disabled}
            value={data.agentDescription}
            id='quickstart-agent-description'
            sx={{ bgcolor: `background.paper` }}
            placeholder='What does this agent do? (optional)'
            onChange={(e) => onChange({ agentDescription: e.target.value })}
          />
        </FormSection>
      </Box>

      <Box>
        <AdvancedToggle onClick={() => setShowAdvanced(!showAdvanced)}>
          <TuneIcon
            sx={{
              fontSize: 16,
              color: `text.secondary`,
              transition: `color 0.2s`,
              ...(showAdvanced && { color: `primary.main` }),
            }}
          />
          <Text
            variant='subtitle2'
            sx={{
              fontWeight: 500,
              color: showAdvanced ? `primary.main` : `text.secondary`,
              transition: `color 0.2s`,
            }}
          >
            Advanced
          </Text>
          <ExpandMoreIcon
            sx={{
              fontSize: 18,
              color: `text.secondary`,
              transition: `transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), color 0.2s`,
              transform: showAdvanced ? `rotate(180deg)` : `rotate(0deg)`,
              ml: `auto`,
              ...(showAdvanced && { color: `primary.main` }),
            }}
          />
        </AdvancedToggle>
        <Collapse
          in={showAdvanced}
          timeout={300}
        >
          <FormSection sx={{ mt: 1.5 }}>
            <TextInput
              textarea
              fullWidth
              minRows={4}
              maxRows={12}
              disabled={disabled}
              label='System Prompt'
              value={data.systemPrompt}
              id='quickstart-system-prompt'
              sx={{ bgcolor: `background.paper` }}
              placeholder='Instructions for the agent (optional)'
              onChange={(e) => onChange({ systemPrompt: e.target.value })}
            />
          </FormSection>
        </Collapse>
      </Box>
    </Box>
  )
}
