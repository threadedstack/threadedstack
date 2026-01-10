import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  CardActions,
  Typography,
  Grid,
  IconButton,
  Tooltip,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useTeams } from '@TAF/state/selectors'
import { CreateTeamDialog } from './CreateTeamDialog'
import { fetchTeams, deleteTeam } from '@TAF/actions/teams'

export type TTeams = {}

export const Teams = (props: TTeams) => {
  const [teams] = useTeams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const loadTeams = async () => {
      setLoading(true)
      await fetchTeams()
      setLoading(false)
    }
    loadTeams()
  }, [])

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const handleViewTeam = (teamId: string) => {
    navigate(`/teams/${teamId}`)
  }

  const handleDeleteTeam = async (teamId: string, teamName: string) => {
    if (!window.confirm(`Are you sure you want to delete team "${teamName}"?`)) {
      return
    }
    await deleteTeam(teamId)
  }

  const teamsArray = teams ? Object.values(teams) : []

  return (
    <Page className='tdsk-teams-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Typography
          variant='h4'
          component='h1'
        >
          Teams
        </Typography>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Team
        </Button>
      </Box>

      {loading && <Typography>Loading teams...</Typography>}

      {!loading && teamsArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No teams yet. Create your first team to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && teamsArray.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {teamsArray.map((team) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={team.id}
            >
              <Card>
                <CardContent>
                  <Typography
                    variant='h6'
                    component='h2'
                    gutterBottom
                  >
                    {team.name}
                  </Typography>
                  <Typography
                    color='text.secondary'
                    variant='body2'
                  >
                    {team.description || 'No description'}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    ID: {team.id}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Tooltip title='View Team'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => handleViewTeam(team.id)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Team'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDeleteTeam(team.id, team.name)}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <CreateTeamDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Teams
