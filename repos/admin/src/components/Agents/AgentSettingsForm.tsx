import { Box, Stack } from '@mui/material'
import { Text, SwitchInput } from '@tdsk/components'

export type TAgentSettingsFormProps = {
  active: boolean
  loading: boolean
  streaming: boolean
  onActiveChange: (value: boolean) => void
  onStreamingChange: (value: boolean) => void
}

export const AgentSettingsForm = (props: TAgentSettingsFormProps) => {
  const { active, loading, streaming, onActiveChange, onStreamingChange } = props

  return (
    <Box>
      <Text
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Agent Settings
      </Text>
      <Stack spacing={2}>
        <SwitchInput
          id='agent-streaming'
          disabled={loading}
          checked={streaming}
          label='Enable Streaming'
          onChange={(e, checked) => onStreamingChange(checked)}
        />

        <SwitchInput
          label='Active'
          checked={active}
          id='agent-active'
          disabled={loading}
          onChange={(e, checked) => onActiveChange(checked)}
        />
      </Stack>
    </Box>
  )
}
