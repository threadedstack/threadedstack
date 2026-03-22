import type { TAgentStepData } from '@TAF/types'

import Box from '@mui/material/Box'
import { TextInput } from '@tdsk/components'
import Accordion from '@mui/material/Accordion'
import TuneIcon from '@mui/icons-material/Tune'
import Typography from '@mui/material/Typography'
import AccordionSummary from '@mui/material/AccordionSummary'
import AccordionDetails from '@mui/material/AccordionDetails'
import AccountTreeIcon from '@mui/icons-material/AccountTree'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined'
import {
  SectionHeader,
  SectionIcon,
  FormSection,
} from '@TAF/components/Quickstart/Quickstart.styled'

export type TAgentStep = {
  disabled?: boolean
  data: TAgentStepData
  onChange: (updates: Partial<TAgentStepData>) => void
}

export const AgentStep = (props: TAgentStep) => {
  const { data, onChange, disabled } = props

  return (
    <Box sx={{ display: `flex`, flexDirection: `column`, gap: 3 }}>
      <Box>
        <SectionHeader>
          <SectionIcon>
            <AccountTreeIcon sx={{ fontSize: 16 }} />
          </SectionIcon>
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 600 }}
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
            sx={{ fontWeight: 600 }}
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
            placeholder='e.g., claude-agent'
            sx={{ bgcolor: `background.paper` }}
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

      <Accordion
        disableGutters
        elevation={0}
        sx={{ border: 0, '&:before': { display: `none` } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <TuneIcon sx={{ fontSize: 16, color: `text.secondary`, mr: 1 }} />
          <Typography
            variant='subtitle2'
            sx={{ fontWeight: 500, color: `text.secondary` }}
          >
            Advanced
          </Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ p: 0 }}>
          <FormSection>
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
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
