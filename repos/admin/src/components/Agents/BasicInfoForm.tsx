import { Box, Stack } from '@mui/material'
import { Text, TextInput, SelectInput } from '@tdsk/components'

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

  const providerOptions = aiProviders.map((provider) => ({
    label: provider.name,
    value: provider.id,
  }))

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Basic Information
      </Text>
      <Stack spacing={2}>
        <TextInput
          autoFocus
          required
          fullWidth
          value={name}
          id='agent-name'
          disabled={loading}
          label='Agent Name'
          placeholder='e.g., Customer Support Bot'
          onChange={(e) => onNameChange(e.target.value)}
        />

        <TextInput
          textarea
          fullWidth
          minRows={2}
          disabled={loading}
          value={description}
          label='Description'
          id='agent-description'
          placeholder='Describe what this agent does...'
          onChange={(e) => onDescriptionChange(e.target.value)}
        />

        <SelectInput
          required
          fullWidth
          disabled={loading}
          label='AI Provider'
          id='agent-provider'
          value={providerId || ''}
          items={
            aiProviders.length === 0
              ? [{ label: 'No AI providers available. Create one first.', value: '' }]
              : providerOptions
          }
          description='The AI provider to use for this agent'
          onChange={(e) => onProviderChange(e.target.value)}
        />
      </Stack>
    </Box>
  )
}
