import type { TFileEntry } from '@TTH/types'

import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'

type TFileTreeDeleteDialog = {
  entry: TFileEntry | null
  onConfirm: () => void
  onCancel: () => void
}

export const FileTreeDeleteDialog = (props: TFileTreeDeleteDialog) => {
  const { entry, onConfirm, onCancel } = props
  const isFolder = entry?.type === `folder`

  return (
    <Dialog
      open={Boolean(entry)}
      onClose={onCancel}
      maxWidth='xs'
      fullWidth
    >
      <DialogTitle>Delete {isFolder ? `Folder` : `File`}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>
          Are you sure you want to delete{` `}
          <strong>{entry?.name}</strong>
          {isFolder ? ` and all its contents` : ``}? This cannot be undone.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          onClick={onCancel}
          size='small'
        >
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          color='error'
          variant='contained'
          size='small'
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  )
}
