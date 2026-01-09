import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Divider,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as AddMemberIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useTeams } from '@TAF/state/selectors'
import { setActiveTeamId } from '@TAF/state/accessors'
import { fetchTeam, deleteTeam } from '@TAF/actions/teams'
import { ERoutePath } from '@TAF/types'

export type TTeam = {}

export const Team = (props: TTeam) => {
  const { teamId } = useParams<{ teamId: string }>()
  const navigate = useNavigate()
  const [teams] = useTeams()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId) return
      setLoading(true)
      await fetchTeam(teamId)
      setLoading(false)
    }
    loadTeam()
  }, [teamId])

  const team = teamId && teams ? teams[teamId] : undefined

  const handleBack = () => {
    navigate(ERoutePath.Teams)
  }

  const handleDelete = async () => {
    if (!team || !teamId) return
    if (!window.confirm(`Are you sure you want to delete team "${team.name}"?`)) {
      return
    }
    const result = await deleteTeam(teamId)
    if (!result.error) {
      navigate(ERoutePath.Teams)
    }
  }

  if (loading) {
    return (
      <Page className='tdsk-team-page'>
        <Typography>Loading team...</Typography>
      </Page>
    )
  }

  if (!team) {
    return (
      <Page className='tdsk-team-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Team not found</Typography>
            <Button
              onClick={handleBack}
              sx={{ mt: 2 }}
            >
              Back to Teams
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-team-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Tooltip title='Back to Teams'>
          <IconButton onClick={handleBack}>
            <BackIcon />
          </IconButton>
        </Tooltip>
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {team.name}
        </Typography>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
          disabled
        >
          Edit
        </Button>
        <Button
          variant='outlined'
          color='error'
          startIcon={<DeleteIcon />}
          onClick={handleDelete}
        >
          Delete
        </Button>
      </Box>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='h6'
            gutterBottom
          >
            Team Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Name
            </Typography>
            <Typography variant='body1'>{team.name}</Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Description
            </Typography>
            <Typography variant='body1'>
              {team.description || 'No description provided'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Team ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {team.id}
            </Typography>
          </Box>

          {team.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(team.createdAt).toLocaleString()}
              </Typography>
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
              <Typography variant='body2'>
                {new Date(team.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant='h6'>Team Members</Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<AddMemberIcon />}
              disabled
            >
              Add Member
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Typography
            color='text.secondary'
            align='center'
          >
            Member management coming soon
          </Typography>
        </CardContent>
      </Card>
    </Page>
  )
}

export default Team
