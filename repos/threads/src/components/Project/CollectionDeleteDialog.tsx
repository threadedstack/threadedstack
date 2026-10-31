import type { TCollectionWithCount } from '@tdsk/domain'

import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogTitle from '@mui/material/DialogTitle'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'

type TCollectionDeleteDialog = {
  collection: TCollectionWithCount | null
  onConfirm: () => void
  onCancel: () => void
}

export const CollectionDeleteDialog = (props: TCollectionDeleteDialog) => {
  const { collection, onConfirm, onCancel } = props

  return (
    <Dialog
      open={Boolean(collection)}
      onClose={onCancel}
      maxWidth='xs'
      fullWidth
    >
      <DialogTitle>Delete Collection</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ fontSize: 14 }}>
          Are you sure you want to delete <strong>{collection?.name}</strong>? All of its
          records will be deleted too. This cannot be undone.
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
