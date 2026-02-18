import Box from '@mui/material/Box'
import { Stack } from '@mui/material'
import { cls } from '@keg-hub/jsutils/cls'
import Autocomplete from '@mui/material/Autocomplete'
import { Text, TextInput, AutoInputText, InputStateHandler } from '@tdsk/components'

export type TBasicInfoFormProps = {
  name: string
  loading: boolean
  description: string
  providerIds: string[]
  onNameChange: (value: string) => void
  onDescriptionChange: (value: string) => void
  aiProviders: Array<{ id: string; name: string }>
  onProviderChange: (providerIds: string[]) => void
}

export const BasicInfoForm = (props: TBasicInfoFormProps) => {
  const {
    name,
    loading,
    providerIds,
    aiProviders,
    description,
    onNameChange,
    onProviderChange,
    onDescriptionChange,
  } = props

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

        <InputStateHandler
          id='agent-providers'
          disabled={loading}
          label='AI Providers'
          description={
            loading
              ? 'Loading providers...'
              : aiProviders.length === 0
                ? 'No AI providers available. Create a provider first.'
                : 'Select AI providers for this agent (first selected is primary)'
          }
        >
          <Autocomplete
            multiple
            id='agent-providers'
            className={cls('tdsk-auto-input', loading && 'disabled')}
            value={providerIds}
            options={aiProviders.map((p) => p.id)}
            getOptionLabel={(id) => aiProviders.find((p) => p.id === id)?.name || id}
            onChange={(_, updates) => onProviderChange(updates)}
            disabled={loading || aiProviders.length === 0}
            renderInput={(params) => (
              <AutoInputText
                {...params}
                sx={{ padding: '0px' }}
                placeholder='Select providers...'
              />
            )}
          />
        </InputStateHandler>
      </Stack>
    </Box>
  )
}
