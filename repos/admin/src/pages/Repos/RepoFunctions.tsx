import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
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
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Code as CodeIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useFunctions } from '@TAF/state/selectors'
import { fetchFunctions, deleteFunction } from '@TAF/actions/functions'
import { setActiveTeamId, setActiveRepoId } from '@TAF/state/accessors'

export type TRepoFunctions = {}

export const RepoFunctions = (props: TRepoFunctions) => {
  const { teamId, repoId } = useParams<{ teamId: string; repoId: string }>()
  const navigate = useNavigate()
  const [functions] = useFunctions()
  const [loading, setLoading] = useState(true)

  // Sync active team and repo with URL params
  useEffect(() => {
    if (teamId) setActiveTeamId(teamId)
    if (repoId) setActiveRepoId(repoId)
  }, [teamId, repoId])

  // Load functions for this repo
  useEffect(() => {
    const loadData = async () => {
      if (!repoId) return
      setLoading(true)
      await fetchFunctions({ repoId })
      setLoading(false)
    }
    loadData()
  }, [repoId])

  // Filter functions for this repo
  const repoFunctions = useMemo(() => {
    if (!functions || !repoId) return []
    return Object.values(functions).filter(func => func.repoId === repoId)
  }, [functions, repoId])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete function "${name}"?`)) {
      return
    }
    const result = await deleteFunction(id)
    if (result.error) {
      alert(`Failed to delete function: ${result.error.message}`)
    }
  }

  const handleCreate = () => {
    navigate(`/teams/${teamId}/repos/${repoId}/functions/new`)
  }

  const handleEdit = (functionId: string) => {
    navigate(`/teams/${teamId}/repos/${repoId}/functions/${functionId}`)
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-functions-page'>
        <Typography>Loading functions...</Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-functions-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant='h4' component='h1' sx={{ flex: 1 }}>
          Functions
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Function
        </Button>
      </Box>

      {repoFunctions.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color='text.secondary'>
              No functions found for this repository.
            </Typography>
            <Button
              variant='outlined'
              startIcon={<AddIcon />}
              onClick={handleCreate}
              sx={{ mt: 2 }}
            >
              Create Your First Function
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={3}>
          {repoFunctions.map(func => (
            <Grid item xs={12} sm={6} md={4} key={func.id}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <CodeIcon color='primary' />
                    <Typography variant='h6' component='div'>
                      {func.name}
                    </Typography>
                  </Box>

                  <Box sx={{ mb: 2 }}>
                    <Typography
                      variant='caption'
                      color='text.secondary'
                      display='block'
                    >
                      Language
                    </Typography>
                    <Chip
                      label={func.language}
                      size='small'
                      color='primary'
                      variant='outlined'
                      sx={{ mt: 0.5 }}
                    />
                  </Box>

                  {func.endpointId && (
                    <Box sx={{ mb: 2 }}>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        display='block'
                      >
                        Endpoint
                      </Typography>
                      <Typography
                        variant='body2'
                        fontFamily='monospace'
                        sx={{ wordBreak: 'break-all', mt: 0.5 }}
                      >
                        {func.endpointId}
                      </Typography>
                    </Box>
                  )}

                  {func.createdAt && (
                    <Box>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        display='block'
                      >
                        Created
                      </Typography>
                      <Typography variant='body2' sx={{ mt: 0.5 }}>
                        {new Date(func.createdAt).toLocaleDateString()}
                      </Typography>
                    </Box>
                  )}
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', p: 2, pt: 0 }}>
                  <Button
                    size='small'
                    onClick={() => handleEdit(func.id)}
                  >
                    Edit
                  </Button>
                  <Tooltip title='Delete function'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDelete(func.id, func.name)}
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
    </Page>
  )
}

export default RepoFunctions
