import { Box, Stack, Switch, Typography, FormControlLabel } from '@mui/material'

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
      <Typography
        variant='subtitle2'
        sx={{ fontWeight: 600, mb: 2 }}
      >
        Agent Settings
      </Typography>
      <Stack spacing={1}>
        <FormControlLabel
          label='Enable Streaming'
          control={
            <Switch
              checked={streaming}
              onChange={(e) => onStreamingChange(e.target.checked)}
              disabled={loading}
            />
          }
        />

        <FormControlLabel
          label='Active'
          control={
            <Switch
              checked={active}
              disabled={loading}
              onChange={(e) => onActiveChange(e.target.checked)}
            />
          }
        />
      </Stack>
    </Box>
  )
}
