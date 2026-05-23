import Box from '@mui/material/Box'
import { Add } from '@mui/icons-material'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'

export type TNoInstances = {
  orgId: string
  projectId: string
  canExecSandbox?: boolean
  onNewInstance?: () => any
}

export const NoInstances = (props: TNoInstances) => {
  const { orgId, projectId, onNewInstance, canExecSandbox } = props

  return (
    <Box
      sx={{
        py: 6,
        border: 1,
        borderRadius: `8px`,
        textAlign: `center`,
        borderColor: `divider`,
        bgcolor: `background.paper`,
      }}
    >
      <Typography
        color='text.secondary'
        sx={{ mb: 2 }}
      >
        No instances running
      </Typography>
      {canExecSandbox && (
        <Button
          size='small'
          variant='contained'
          startIcon={<Add />}
          onClick={onNewInstance}
          disabled={!orgId || !projectId}
        >
          Start Instance
        </Button>
      )}
    </Box>
  )
}
