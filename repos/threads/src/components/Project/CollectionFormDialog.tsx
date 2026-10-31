import type { TCollectionWithCount } from '@tdsk/domain'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import TextField from '@mui/material/TextField'
import DialogTitle from '@mui/material/DialogTitle'
import { useState, useEffect } from 'react'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import { collectionApi } from '@TTH/services/collectionApi'

export type TCollectionFormDialog = {
  open: boolean
  orgId: string
  projectId: string
  onClose: () => void
  collection?: TCollectionWithCount | null
  onSaved: (collection: TCollectionWithCount) => void
}

export const CollectionFormDialog = (props: TCollectionFormDialog) => {
  const { open, orgId, projectId, collection, onClose, onSaved } = props
  const isEditMode = Boolean(collection)

  const [name, setName] = useState(``)
  const [description, setDescription] = useState(``)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) return
    setName(collection?.name || ``)
    setDescription(collection?.description || ``)
  }, [open, collection])

  const onCancel = () => {
    if (saving) return
    onClose()
  }

  const onSubmit = async (evt: React.FormEvent) => {
    evt.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error(`Collection name is required`)
      return
    }

    setSaving(true)

    const data = { name: trimmedName, description: description.trim() || null }
    const resp =
      isEditMode && collection
        ? await collectionApi.update(orgId, projectId, collection.name, data)
        : await collectionApi.create(orgId, projectId, data)

    setSaving(false)

    if (resp.error) {
      toast.error(`Failed to ${isEditMode ? `update` : `create`} collection`, {
        description: resp.error.message,
      })
      return
    }

    resp.data &&
      onSaved({
        recordCount: collection?.recordCount ?? 0,
        ...resp.data,
      } as TCollectionWithCount)
  }

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      maxWidth='xs'
      fullWidth
    >
      <DialogTitle>{isEditMode ? `Edit Collection` : `Create Collection`}</DialogTitle>
      <form onSubmit={onSubmit}>
        <DialogContent>
          <Box sx={{ display: `flex`, flexDirection: `column`, gap: 2, pt: `4px` }}>
            <TextField
              autoFocus
              required
              fullWidth
              size='small'
              label='Name'
              value={name}
              disabled={saving}
              onChange={(e) => setName(e.target.value)}
            />

            <TextField
              fullWidth
              multiline
              size='small'
              minRows={2}
              maxRows={4}
              label='Description'
              value={description}
              disabled={saving}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            size='small'
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </Button>
          <Button
            type='submit'
            size='small'
            color='primary'
            variant='contained'
            disabled={saving}
          >
            {isEditMode ? `Save` : `Create`}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  )
}
