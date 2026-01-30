import { Box, Stack, TextField, Typography } from '@mui/material'

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
    <Box>
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Model Configuration
      </Typography>
      <Stack spacing={2}>
        <TextField
          fullWidth
          label='Model'
          value={model}
          disabled={loading}
          placeholder='e.g., gpt-4o, claude-3-opus'
          onChange={(e) => onModelChange(e.target.value)}
        />

        <TextField
          fullWidth
          type='number'
          value={maxTokens}
          label='Max Tokens'
          disabled={loading}
          helperText='Maximum tokens for response generation'
          onChange={(e) => onMaxTokensChange(Number.parseInt(e.target.value) || 100000)}
        />

        <TextField
          fullWidth
          type='number'
          disabled={loading}
          value={temperature}
          label='Temperature'
          inputProps={{ step: 0.1, min: 0, max: 2 }}
          helperText='Controls randomness (0.0 - 2.0)'
          onChange={(e) => onTemperatureChange(Number.parseFloat(e.target.value))}
        />
      </Stack>
    </Box>
  )
}
