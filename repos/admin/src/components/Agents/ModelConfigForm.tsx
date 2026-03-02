import { Box } from '@mui/material'
import { TextInput, SliderInput } from '@tdsk/components'
import { FormSection } from '@TAF/components/FormSection/FormSection'

export type TModelConfigForm = {
  loading: boolean
  maxTokens: number
  temperature: number
  onMaxTokensChange: (value: number) => void
  onTemperatureChange: (value: number) => void
}

export const ModelConfigForm = (props: TModelConfigForm) => {
  const { loading, maxTokens, temperature, onMaxTokensChange, onTemperatureChange } =
    props

  return (
    <FormSection title='Response Configuration'>
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
