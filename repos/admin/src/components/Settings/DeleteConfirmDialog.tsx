import { useState, useEffect } from 'react'
import { Button, Typography } from '@mui/material'
import { Dialog, TextInput } from '@tdsk/components'

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
  onClose,
  onConfirm,
  entityName,
  entityType,
  warningText,
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
      title={`Delete ${entityType}?`}
      content={
        <>
          <Typography>
            Are you sure you want to delete <strong>{entityName}</strong>?
            {warningText && ` ${warningText}`}
          </Typography>
          <TextInput
            fullWidth
            sx={{ mt: 2 }}
            value={confirmName}
            id='tdsk-delete-confirm'
            label={`Type ${entityType} name to confirm`}
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </>
      }
      actions={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button
            color='error'
            variant='contained'
            onClick={onConfirm}
            disabled={isConfirmDisabled}
          >
            Delete {entityType}
          </Button>
        </>
      }
    />
  )
}
