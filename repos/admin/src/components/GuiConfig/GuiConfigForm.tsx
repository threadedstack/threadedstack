import { useState, useCallback, useMemo } from 'react'
import {
  Box,
  Switch,
  FormControlLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from '@mui/material'
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material'
import { TextInput } from '@tdsk/components'
import type { TGuiConfig } from '@tdsk/domain'
import { Code } from '@TAF/components/Code/Code'
import { MonacoOptions } from '@TAF/constants/monaco'
import { ModelSelect } from '@TAF/components/Agents/ModelSelect'
import { ProviderSelectorSingle } from '@TAF/components/Selectors/ProviderSelector'

export type TGuiConfigFormProps = {
  config: TGuiConfig | undefined
  orgProviders: { id: string; name: string; brand: string }[]
  disabled?: boolean
  onChange: (config: TGuiConfig | undefined) => void
}

const DefaultConfig: TGuiConfig = {
  enabled: false,
  providerId: '',
  model: '',
  maxRetries: 2,
}

export const GuiConfigForm = ({
  config,
  orgProviders,
  disabled,
  onChange,
}: TGuiConfigFormProps) => {
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
      <FormControlLabel
        control={
          <Switch
            checked={current.enabled}
            onChange={(_, checked) => update({ enabled: checked })}
            disabled={disabled}
          />
        }
        label='Enable Generative UI'
      />

      <ProviderSelectorSingle
        providerId={current.providerId}
        providers={providerList}
        disabled={isDisabled}
        onChange={(providerId) => update({ providerId, model: '' })}
      />

      <ModelSelect
        size='small'
        disabled={isDisabled}
        brand={selectedProvider?.brand ?? ''}
        id={`gui-config-model-${current.providerId}`}
        model={current.model || ''}
        onChange={(model) => update({ model })}
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
        onChange={(_, open) => setPromptOpen(open)}
        disabled={isDisabled}
        sx={{ '&:before': { display: 'none' } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant='body2'>Custom System Prompt (optional)</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Code
            id='gui-config-system-prompt'
            language='plaintext'
            disabled={isDisabled}
            options={MonacoOptions}
            defaultValue={current.systemPrompt ?? ''}
            label=''
            onChange={(value) => update({ systemPrompt: value || undefined })}
            sx={{ minHeight: 200 }}
          />
        </AccordionDetails>
      </Accordion>
    </Box>
  )
}
