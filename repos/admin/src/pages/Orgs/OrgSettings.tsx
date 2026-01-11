import { ERoutePath } from '@TAF/types'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useOrgs } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { setActiveOrgId } from '@TAF/state/accessors'
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material'
import { fetchOrg, updateOrg, deleteOrg } from '@TAF/actions/orgs'
import {
  Box,
  Card,
  Alert,
  Dialog,
  Button,
  Divider,
  TextField,
  Typography,
  IconButton,
  DialogTitle,
  CardContent,
  DialogContent,
  DialogActions,
  CircularProgress,
} from '@mui/material'

export type TOrgSettings = {}

export const OrgSettings = (props: TOrgSettings) => {
  const { orgId } = useParams<{ orgId: string }>()
  const navigate = useNavigate()
  const [orgs] = useOrgs()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [originalName, setOriginalName] = useState('')
  const [originalDescription, setOriginalDescription] = useState('')

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [confirmName, setConfirmName] = useState('')

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  useEffect(() => {
    const loadData = async () => {
      if (!orgId) return

      setLoading(true)
      setError(null)

      const orgResult = await fetchOrg(orgId)

      if (orgResult.error) {
        setError(orgResult.error.message)
      } else if (orgResult.org) {
        setName(orgResult.org.name || '')
        setDescription(orgResult.org.description || '')
        setOriginalName(orgResult.org.name || '')
        setOriginalDescription(orgResult.org.description || '')
      }

      setLoading(false)
    }

    loadData()
  }, [orgId])

  const org = orgs && orgId ? orgs[orgId] : null
  const hasChanges = name !== originalName || description !== originalDescription

  const onSave = async () => {
    if (!orgId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateOrg(orgId, { name, description })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Org updated successfully')
      setOriginalName(name)
      setOriginalDescription(description)
    }

    setSaving(false)
  }

  const onDeleteClick = () => {
    setDeleteDialogOpen(true)
    setConfirmName('')
  }

  const onDelete = async () => {
    if (!orgId || !org) return

    const result = await deleteOrg(orgId)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(ERoutePath.Orgs)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setSuccess('Copied to clipboard')
    setTimeout(() => setSuccess(null), 2000)
  }

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString()
  }

  return (
    <Page className='tdsk-org-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Org Settings
        </Typography>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert
          severity='error'
          sx={{ mb: 3 }}
        >
          {error}
        </Alert>
      )}

      {success && (
        <Alert
          severity='success'
          sx={{ mb: 3 }}
        >
          {success}
        </Alert>
      )}

      {!loading && org && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>General Settings</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  value={name}
                  label='Org Name'
                  onChange={(e) => setName(e.target.value)}
                />
                <TextField
                  rows={3}
                  multiline
                  fullWidth
                  label='Description'
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
                <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <Button
                    onClick={onSave}
                    variant='contained'
                    disabled={!hasChanges || saving}
                  >
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                </Box>
              </Box>
            </CardContent>
          </Card>

          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>Org Information</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Org ID
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant='body2'
                    fontFamily='monospace'
                  >
                    {org.id}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => copyToClipboard(org.id)}
                  >
                    <ContentCopyIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Box>
              {org.createdAt && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                  >
                    Created
                  </Typography>
                  <Typography variant='body2'>{formatDate(org.createdAt)}</Typography>
                </Box>
              )}
              {org.updatedAt && (
                <Box>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                  >
                    Last Updated
                  </Typography>
                  <Typography variant='body2'>{formatDate(org.updatedAt)}</Typography>
                </Box>
              )}
            </CardContent>
          </Card>

          <Card sx={{ border: '1px solid', borderColor: 'error.main' }}>
            <CardContent>
              <Typography
                variant='h6'
                color='error'
              >
                Danger Zone
              </Typography>
              <Divider sx={{ my: 2 }} />
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Box>
                  <Typography variant='body1'>Delete this org</Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    Once deleted, this action cannot be undone. All repos and data will be
                    lost.
                  </Typography>
                </Box>
                <Button
                  variant='outlined'
                  color='error'
                  onClick={onDeleteClick}
                >
                  Delete Org
                </Button>
              </Box>
            </CardContent>
          </Card>
        </>
      )}

      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
      >
        <DialogTitle>Delete Org?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{org?.name}</strong>? This will
            permanently delete all associated repos, secrets, and configurations.
          </Typography>
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            value={confirmName}
            label='Type org name to confirm'
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color='error'
            variant='contained'
            onClick={onDelete}
            disabled={confirmName !== org?.name}
          >
            Delete Org
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  )
}

export default OrgSettings
