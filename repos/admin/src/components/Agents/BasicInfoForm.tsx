import Box from '@mui/material/Box'
import { Stack } from '@mui/material'
import { Text, TextInput } from '@tdsk/components'
import { ProviderPriorityList } from './ProviderPriorityList'

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

        <ProviderPriorityList
          loading={loading}
          providerIds={providerIds}
          aiProviders={aiProviders}
          onChange={onProviderChange}
        />
      </Stack>
    </Box>
  )
}
