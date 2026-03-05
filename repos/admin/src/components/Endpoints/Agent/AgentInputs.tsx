import type { TKeyValuePair } from '@TAF/types'
import type { Secret, Function as FunctionModel } from '@tdsk/domain'

import { TextInput } from '@tdsk/components'
import { Envs } from '@TAF/components/Endpoints/Envs'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import {
  ToolsSelector,
  AgentSelector,
  ProviderSelector,
  FunctionsSelector,
} from '@TAF/components/Selectors'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TAgentInputs = {
  loading: boolean
  agents?: Array<{ id: string; name: string }>

  // Agent selection
  agentId: string
  onAgentIdChange: (value: string) => void

  // Overrides
  model: string
  tools: string[]
  maxTokens: string
  systemPrompt: string
  functionIds: string[]
  providerIds: string[]
  availableFunctions?: FunctionModel[]
  onModelChange: (value: string) => void
  onToolsChange: (tools: string[]) => void
  onMaxTokensChange: (value: string) => void
  onFunctionIdsChange: (ids: string[]) => void
  onProviderIdsChange: (ids: string[]) => void
  onSystemPromptChange: (value: string) => void
  providers?: Array<{ id: string; name: string }>

  // Environment
  secrets: string[]
  envVars: TKeyValuePair[]
  availableSecrets: Secret[]
  onEnvVarsChange: (pairs: TKeyValuePair[]) => void
  onSecretsChange: (secrets: string[]) => void
}

export const AgentInputs = (props: TAgentInputs) => {
  const {
    model,
    tools,
    envVars,
    secrets,
    loading,
    agentId,
    maxTokens,
    functionIds,
    providerIds,
    agents = [],
    systemPrompt,
    providers = [],
    availableSecrets,
    availableFunctions = [],
  } = props

  const hasOverrides =
    systemPrompt || model || maxTokens || providerIds.length > 0 || functionIds.length > 0
  const hasEnvConfig = envVars.length > 0 || secrets.length > 0

  return (
    <>
      <AgentSelector
        agents={agents}
        loading={loading}
        agentId={agentId}
        onChange={props.onAgentIdChange}
      />

      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Agent Overrides
          </Typography>
          {hasOverrides && (
            <Chip
              size='small'
              label='Configured'
              color='primary'
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextInput
              fullWidth
              multiline
              minRows={3}
              disabled={loading}
              value={systemPrompt}
              id='agent-system-prompt'
              label='System Prompt Override'
              placeholder='Override the default system prompt'
              onChange={(e) => props.onSystemPromptChange(e.target.value)}
            />
            <TextInput
              fullWidth
              value={model}
              id='agent-model'
              disabled={loading}
              label='Model Override'
              placeholder='gpt-4, claude-3-opus, etc.'
              onChange={(e) => props.onModelChange(e.target.value)}
            />
            <TextInput
              fullWidth
              type='number'
              value={maxTokens}
              disabled={loading}
              placeholder='4096'
              id='agent-max-tokens'
              label='Max Tokens Override'
              onChange={(e) => props.onMaxTokensChange(e.target.value)}
            />
            <ToolsSelector
              loading={loading}
              selectedTools={tools}
              onChange={(updates: string[]) => props.onToolsChange(updates)}
            />
            <ProviderSelector
              loading={loading}
              providers={providers}
              selectedProviderIds={providerIds}
              onChange={props.onProviderIdsChange}
            />
            <FunctionsSelector
              loading={loading}
              selectedFunctionIds={functionIds}
              onChange={props.onFunctionIdsChange}
              availableFunctions={availableFunctions}
            />
            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem' }}
            >
              Optional overrides for agent behavior. Leave empty to use agent defaults.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Agent Environment
          </Typography>
          {hasEnvConfig && (
            <Chip
              size='small'
              label='Configured'
              color='primary'
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Envs
              envVars={envVars}
              secrets={secrets}
              disabled={loading}
              secretsList={availableSecrets}
              onEnvVarsChange={props.onEnvVarsChange}
              onSecretsChange={props.onSecretsChange}
              helperText='Environment variables and secrets exposed to the agent during execution'
            />
          </Box>
        </AccordionDetails>
      </Accordion>
    </>
  )
}
