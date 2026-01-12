import type { ReactNode } from 'react'
import type { SxProps, Theme } from '@mui/material'
import { Alert, Button, Box } from '@mui/material'

export type TConfirmDeleteAlert = {
  text?: ReactNode
  itemName: string
  loading?: boolean
  cancelText?: string
  deleteText?: string
  confirmText?: string
  sx?: SxProps<Theme>
  onCancel: () => void
  onConfirm: () => void
}

export const ConfirmDeleteAlert = (props: TConfirmDeleteAlert) => {
  const {
    sx,
    itemName,
    onCancel,
    onConfirm,
    loading = false,
    cancelText = `Cancel`,
    confirmText = `Confirm`,
    deleteText = `Deleting...`,
    text = `Are you sure you want to delete "${itemName}"?`,
  } = props

  return (
    <Alert
      sx={sx}
      severity='warning'
      action={
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size='small'
            color='inherit'
            onClick={onCancel}
            disabled={loading}
          >
            {cancelText}
          </Button>
          <Button
            color='inherit'
            size='small'
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? deleteText : confirmText}
          </Button>
        </Box>
      }
    >
      {text}
    </Alert>
  )
}

export default ConfirmDeleteAlert
