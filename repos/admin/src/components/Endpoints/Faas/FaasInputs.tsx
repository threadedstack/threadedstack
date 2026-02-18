import type { TKeyValuePair } from '@TAF/types'
import type { Secret, Function as FunctionModel } from '@tdsk/domain'

import { SelectInput } from '@tdsk/components'
import { Envs } from '@TAF/components/Endpoints/Envs'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import { KeyValueEditor } from '@TAF/components/KeyValueEditor'
import { ResourcesLimits } from '@TAF/components/Endpoints/Faas/ResourcesLimits'
import {
  Box,
  Chip,
  Alert,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TFaasInputs = {
  loading: boolean
  // Function selection
  functionId: string
  availableFunctions: FunctionModel[]
  onFunctionIdChange: (value: string) => void

  // Arguments
  arguments: TKeyValuePair[]
  onArgumentsChange: (pairs: TKeyValuePair[]) => void

  // Environment
  secrets: string[]
  envVars: TKeyValuePair[]
  availableSecrets: Secret[]
  onEnvVarsChange: (pairs: TKeyValuePair[]) => void
  onSecretsChange: (secrets: string[]) => void

  // ResourcesLimits
  memory: string
  timeout: string
  onTimeoutChange: (value: string) => void
  onMemoryChange: (value: string) => void
}

export const FaasInputs = (props: TFaasInputs) => {
  const {
    loading,
    functionId,
    availableFunctions,
    arguments: faasArguments,
    envVars,
    secrets,
    availableSecrets,
    timeout,
    memory,
  } = props

  const functionOptions = availableFunctions.map((fn) => ({
    value: fn.id,
    label: `${fn.name} (${fn.language})`,
  }))

  return (
    <>
      {/* Function Selection */}
      <SelectInput
        required
        id='function-select'
        disabled={loading}
        label='Select Function'
        items={functionOptions}
        value={functionId}
        onChange={(e) => props.onFunctionIdChange(e.target.value)}
        placeholder='Choose a function to execute'
      />

      {/* Function Arguments */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Function Arguments
          </Typography>
          {faasArguments.length > 0 && (
            <Chip
              size='small'
              label={faasArguments.length}
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <KeyValueEditor
              pairs={faasArguments}
              disabled={loading}
              secrets={availableSecrets}
              enableSecretReferences={true}
              keyPlaceholder='Argument Name'
              valuePlaceholder='Argument Value (JSON supported)'
              onChange={props.onArgumentsChange}
            />
            <Alert
              severity='info'
              sx={{ fontSize: '0.875rem', mt: 1 }}
            >
              Arguments passed to the function when the endpoint is called. Values can be
              JSON objects or strings.
            </Alert>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Environment Variables */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography
            variant='subtitle1'
            fontWeight={500}
          >
            Environment Variables
          </Typography>
          {(envVars.length > 0 || secrets.length > 0) && (
            <Chip
              size='small'
              label='Configured'
              color='primary'
              sx={{ ml: 1 }}
            />
          )}
        </AccordionSummary>
        <AccordionDetails>
          <Envs
            envVars={envVars}
            secrets={secrets}
            disabled={loading}
            secretsList={availableSecrets}
            onEnvVarsChange={props.onEnvVarsChange}
            onSecretsChange={props.onSecretsChange}
          />
        </AccordionDetails>
      </Accordion>

      {/* Resource Limits */}
      <ResourcesLimits
        memory={memory}
        timeout={timeout}
        disabled={loading}
        onTimeoutChange={props.onTimeoutChange}
        onMemoryChange={props.onMemoryChange}
      />
    </>
  )
}
