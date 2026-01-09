import { ERoutePath } from '@TAF/types'
import { useEffect, useState } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { useTeams } from '@TAF/state/selectors'
import { useParams, useNavigate } from 'react-router'
import { setActiveTeamId } from '@TAF/state/accessors'
import { ContentCopy as ContentCopyIcon } from '@mui/icons-material'
import { fetchTeam, updateTeam, deleteTeam } from '@TAF/actions/teams'
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

export type TTeamSettings = {}

export const TeamSettings = (props: TTeamSettings) => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [teams] = useTeams()
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
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  useEffect(() => {
    const loadData = async () => {
      if (!teamId) return

      setLoading(true)
      setError(null)

      const teamResult = await fetchTeam(teamId)

      if (teamResult.error) {
        setError(teamResult.error.message)
      } else if (teamResult.team) {
        setName(teamResult.team.name || '')
        setDescription(teamResult.team.description || '')
        setOriginalName(teamResult.team.name || '')
        setOriginalDescription(teamResult.team.description || '')
      }

      setLoading(false)
    }

    loadData()
  }, [teamId])

  const team = teams && teamId ? teams[teamId] : null
  const hasChanges = name !== originalName || description !== originalDescription

  const onSave = async () => {
    if (!teamId || !hasChanges) return

    setSaving(true)
    setError(null)
    setSuccess(null)

    const result = await updateTeam(teamId, { name, description })

    if (result.error) {
      setError(result.error.message)
    } else {
      setSuccess('Team updated successfully')
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
    if (!teamId || !team) return

    const result = await deleteTeam(teamId)

    if (result.error) {
      setError(result.error.message)
      setDeleteDialogOpen(false)
    } else {
      navigate(ERoutePath.Teams)
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
    <Page className='tdsk-team-settings-page'>
      <Box sx={{ mb: 3 }}>
        <Typography
          variant='h5'
          component='h1'
        >
          Team Settings
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

      {!loading && team && (
        <>
          <Card sx={{ mb: 3 }}>
            <CardContent>
              <Typography variant='h6'>General Settings</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  fullWidth
                  value={name}
                  label='Team Name'
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
              <Typography variant='h6'>Team Information</Typography>
              <Divider sx={{ my: 2 }} />
              <Box sx={{ mb: 2 }}>
                <Typography
                  variant='subtitle2'
                  color='text.secondary'
                >
                  Team ID
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    variant='body2'
                    fontFamily='monospace'
                  >
                    {team.id}
                  </Typography>
                  <IconButton
                    size='small'
                    onClick={() => copyToClipboard(team.id)}
                  >
                    <ContentCopyIcon fontSize='small' />
                  </IconButton>
                </Box>
              </Box>
              {team.createdAt && (
                <Box sx={{ mb: 2 }}>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                  >
                    Created
                  </Typography>
                  <Typography variant='body2'>{formatDate(team.createdAt)}</Typography>
                </Box>
              )}
              {team.updatedAt && (
                <Box>
                  <Typography
                    variant='subtitle2'
                    color='text.secondary'
                  >
                    Last Updated
                  </Typography>
                  <Typography variant='body2'>{formatDate(team.updatedAt)}</Typography>
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
                  <Typography variant='body1'>Delete this team</Typography>
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
                  Delete Team
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
        <DialogTitle>Delete Team?</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{team?.name}</strong>? This will
            permanently delete all associated repos, secrets, and configurations.
          </Typography>
          <TextField
            fullWidth
            sx={{ mt: 2 }}
            value={confirmName}
            label='Type team name to confirm'
            onChange={(e) => setConfirmName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            color='error'
            variant='contained'
            onClick={onDelete}
            disabled={confirmName !== team?.name}
          >
            Delete Team
          </Button>
        </DialogActions>
      </Dialog>
    </Page>
  )
}

export default TeamSettings
