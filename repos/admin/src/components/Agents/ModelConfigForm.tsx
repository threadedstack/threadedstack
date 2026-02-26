import { Box } from '@mui/material'
import { TextInput, SliderInput } from '@tdsk/components'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TModelConfigForm = {
  model: string
  loading: boolean
  maxTokens: number
  temperature: number
  onModelChange: (value: string) => void
  onMaxTokensChange: (value: number) => void
  onTemperatureChange: (value: number) => void
}

export const ModelConfigForm = (props: TModelConfigForm) => {
  const {
    model,
    loading,
    maxTokens,
    temperature,
    onModelChange,
    onMaxTokensChange,
    onTemperatureChange,
  } = props

  return (
    <FormSection title='Model Configuration'>
      <TextInput
        fullWidth
        label='Model'
        value={model}
        id='agent-model'
        disabled={loading}
        placeholder='e.g., gpt-4o, claude-3-opus'
        onChange={(e) => onModelChange(e.target.value)}
      />

      <TextInput
        fullWidth
        type='number'
        label='Max Tokens'
        disabled={loading}
        id='agent-max-tokens'
        value={maxTokens.toString()}
        description='Maximum tokens for response generation'
        onChange={(e) => onMaxTokensChange(Number.parseInt(e.target.value) || 100000)}
      />

      <Box sx={{ width: '100%' }}>
        <SliderInput
          min={0}
          max={2}
          step={0.1}
          disabled={loading}
          value={temperature}
          label='Temperature'
          id='agent-temperature'
          valueLabelDisplay='auto'
          description='Controls randomness (0.0 - 2.0)'
          onChange={(_, value) => onTemperatureChange(value as number)}
        />
      </Box>
    </FormSection>
  )
}
