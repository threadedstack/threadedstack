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
  Chip,
  useTheme,
} from '@mui/material'
import {
  Add as AddIcon,
  Group as TeamIcon,
  ArrowForward as SelectIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useTeams, useActiveTeamId } from '@TAF/state/selectors'
import { setActiveTeamId } from '@TAF/state/accessors'
import { fetchTeams } from '@TAF/actions/teams'
import { CreateTeamDialog } from '@TAF/pages/Teams/CreateTeamDialog'

export type THome = {}

export const Home = (props: THome) => {
  const navigate = useNavigate()
  const theme = useTheme()
  const [teams] = useTeams()
  const [activeTeamId] = useActiveTeamId()
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

  const handleSelectTeam = (teamId: string) => {
    setActiveTeamId(teamId)
    navigate(`/teams/${teamId}`)
  }

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const teamsArray = teams ? Object.values(teams) : []

  return (
    <Page className='tdsk-home-page'>
      <Box sx={{ mb: 3 }}>
        <Typography variant='h4' component='h1' gutterBottom>
          Select a Team
        </Typography>
        <Typography color='text.secondary'>
          Choose a team to continue or create a new one
        </Typography>
      </Box>

      {loading && (
        <Card>
          <CardContent>
            <Typography align='center'>Loading teams...</Typography>
          </CardContent>
        </Card>
      )}

      {!loading && teamsArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography color='text.secondary' align='center' sx={{ mb: 2 }}>
              No teams yet. Create your first team to get started.
            </Typography>
          </CardContent>
          <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
            <Button
              variant='contained'
              color='primary'
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create Team
            </Button>
          </CardActions>
        </Card>
      )}

      {!loading && teamsArray.length > 0 && (
        <>
          <Grid container spacing={3}>
            {teamsArray.map((team) => {
              const isActiveTeam = team.id === activeTeamId
              return (
                <Grid item xs={12} sm={6} md={4} key={team.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      border: isActiveTeam
                        ? `2px solid ${theme.palette.primary.main}`
                        : '1px solid rgba(0, 0, 0, 0.12)',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                      },
                    }}
                    onClick={() => handleSelectTeam(team.id)}
                  >
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                        <TeamIcon sx={{ mr: 1, color: 'primary.main' }} />
                        <Typography variant='h6' component='h2' sx={{ flexGrow: 1 }}>
                          {team.name}
                        </Typography>
                        {isActiveTeam && (
                          <Chip label='Current' color='primary' size='small' />
                        )}
                      </Box>
                      <Typography color='text.secondary' variant='body2' sx={{ mb: 1 }}>
                        {team.description || 'No description'}
                      </Typography>
                      <Typography variant='caption' color='text.secondary'>
                        ID: {team.id}
                      </Typography>
                    </CardContent>
                    <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                      <Tooltip title={isActiveTeam ? 'Continue with Team' : 'Select Team'}>
                        <IconButton
                          size='small'
                          color='primary'
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSelectTeam(team.id)
                          }}
                        >
                          <SelectIcon />
                        </IconButton>
                      </Tooltip>
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>

          <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
            <Button
              variant='outlined'
              color='primary'
              startIcon={<AddIcon />}
              onClick={handleCreateClick}
            >
              Create New Team
            </Button>
          </Box>
        </>
      )}

      <CreateTeamDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Home
