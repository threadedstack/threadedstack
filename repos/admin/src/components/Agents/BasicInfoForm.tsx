import { Box, Stack, TextField, Typography } from '@mui/material'

export type TBasicInfoFormProps = {
  name: string
  loading: boolean
  description: string
  providerId: string | null
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  aiProviders: Array<{ id: string; name: string }>
  onProviderChange: (providerId: string | null) => void
}

export const BasicInfoForm = (props: TBasicInfoFormProps) => {
  const {
    name,
    loading,
    providerId,
    aiProviders,
    description,
    onNameChange,
    onProviderChange,
    onDescriptionChange,
  } = props

  return (
    <Box>
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Basic Information
      </Typography>
      <Stack spacing={2}>
        <TextField
          autoFocus
          required
          fullWidth
          value={name}
          disabled={loading}
          label='Agent Name'
          placeholder='e.g., Customer Support Bot'
          onChange={(e) => onNameChange(e.target.value)}
        />

        <TextField
          rows={2}
          multiline
          fullWidth
          label='Description'
          placeholder='Describe what this agent does...'
          disabled={loading}
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
        />

        <TextField
          select
          required
          fullWidth
          disabled={loading}
          label='AI Provider'
          value={providerId || ''}
          placeholder='Select an AI provider'
          helperText='The AI provider to use for this agent'
          onChange={(e) => onProviderChange(e.target.value)}
        >
          {aiProviders.length === 0 ? (
            <option
              disabled
              value=''
            >
              No AI providers available. Create one first.
            </option>
          ) : (
            aiProviders.map((provider) => (
              <option
                key={provider.id}
                value={provider.id}
              >
                {provider.name}
              </option>
            ))
          )}
        </TextField>
      </Stack>
    </Box>
  )
}
