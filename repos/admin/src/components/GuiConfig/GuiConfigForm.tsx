import type { TGuiConfig } from '@tdsk/domain'

import { Code } from '@TAF/components/Code/Code'
import { useState, useCallback, useMemo } from 'react'
import { MonacoOptions } from '@TAF/constants/monaco'
import { TextInput, SwitchInput } from '@tdsk/components'
import { ModelSelect } from '@TAF/components/Agents/ModelSelect'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { ProviderSelectorSingle } from '@TAF/components/Selectors/ProviderSelector'
import {
  Box,
  Accordion,
  Typography,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material'

export type TGuiConfigFormProps = {
  config: TGuiConfig | undefined
  orgProviders: { id: string; name: string; brand: string }[]
  disabled?: boolean
  onChange: (config: TGuiConfig | undefined) => void
}

const DefaultConfig: TGuiConfig = {
  model: '',
  maxRetries: 2,
  enabled: false,
  providerId: '',
}

export const GuiConfigForm = (props: TGuiConfigFormProps) => {
  const { config, disabled, onChange, orgProviders } = props

  const current = config ?? DefaultConfig
  const [promptOpen, setPromptOpen] = useState(false)
  const isDisabled = disabled || !current.enabled

  const update = useCallback(
    (partial: Partial<TGuiConfig>) => {
      onChange({ ...current, ...partial })
    },
    [current, onChange]
  )

  const selectedProvider = useMemo(
    () => orgProviders.find((p) => p.id === current.providerId),
    [orgProviders, current.providerId]
  )

  const providerList = useMemo(
    () => orgProviders.map((p) => ({ id: p.id, name: `${p.name} (${p.brand})` })),
    [orgProviders]
  )

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <SwitchInput
        disabled={disabled}
        id='gui-config-enabled'
        checked={current.enabled}
        label='Enable Generative UI'
        onChange={(e, checked) => update({ enabled: checked })}
      />

      <ProviderSelectorSingle
        disabled={isDisabled}
        providers={providerList}
        providerId={current.providerId}
        onChange={(providerId) => update({ providerId, model: '' })}
      />

      <ModelSelect
        size='small'
        disabled={isDisabled}
        model={current.model || ''}
        brand={selectedProvider?.brand ?? ''}
        onChange={(model) => update({ model })}
        id={`gui-config-model-${current.providerId}`}
      />

      <TextInput
        fullWidth
        type='number'
        size='small'
        label='Max Retries'
        disabled={isDisabled}
        id='gui-config-max-retries'
        value={String(current.maxRetries)}
        inputProps={{ min: 0, max: 5 }}
        onChange={(e) =>
          update({
            maxRetries: Math.max(0, Math.min(5, Number.parseInt(e.target.value) || 0)),
          })
        }
      />

      <Accordion
        disableGutters
        expanded={promptOpen}
        disabled={isDisabled}
        sx={{ '&:before': { display: 'none' } }}
        onChange={(_, open) => setPromptOpen(open)}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant='body2'>Custom System Prompt (optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Code
            label=''
            language='plaintext'
            disabled={isDisabled}
            sx={{ minHeight: 200 }}
            options={MonacoOptions}
            id='gui-config-system-prompt'
            defaultValue={current.systemPrompt ?? ''}
            onChange={(value) => update({ systemPrompt: value || undefined })}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
