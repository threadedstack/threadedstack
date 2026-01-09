import { Alert, Button, Box } from '@mui/material'
import type { SxProps, Theme } from '@mui/material'

export type TConfirmDeleteAlert = {
  itemName: string
  onCancel: () => void
  onConfirm: () => void
  loading?: boolean
  sx?: SxProps<Theme>
}

export const ConfirmDeleteAlert = ({
  itemName,
  onCancel,
  onConfirm,
  loading = false,
  sx,
}: TConfirmDeleteAlert) => {
  return (
    <Alert
      severity='warning'
      sx={sx}
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            color='inherit'
            size='small'
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            color='inherit'
            size='small'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? 'Deleting...' : 'Confirm'}
          </Button>
        </Box>
      }
    >
      Are you sure you want to delete "{itemName}"?
    </Alert>
  )
}

export default ConfirmDeleteAlert
