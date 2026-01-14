import { useState, useEffect } from 'react'
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material'

export type TDeleteConfirmDialog = {
  open: boolean
  entityName?: string | null
  entityType: string
  warningText?: string
  onConfirm: () => void
  onClose: () => void
}

export const DeleteConfirmDialog = ({
  open,
  entityName,
  entityType,
  warningText,
  onConfirm,
  onClose,
}: TDeleteConfirmDialog) => {
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    if (!open) {
      setConfirmName('')
    }
  }, [open])

  const isConfirmDisabled = confirmName !== entityName

  return (
    <Dialog
      open={open}
      onClose={onClose}
    >
      <DialogTitle>Delete {entityType}?</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete <strong>{entityName}</strong>?
          {warningText && ` ${warningText}`}
        </Typography>
        <TextField
          fullWidth
          sx={{ mt: 2 }}
          value={confirmName}
          label={`Type ${entityType} name to confirm`}
          onChange={(e) => setConfirmName(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          color='error'
          variant='contained'
          onClick={onConfirm}
          disabled={isConfirmDisabled}
        >
          Delete {entityType}
        </Button>
      </DialogActions>
    </Dialog>
  )
}
