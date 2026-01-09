import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Chip,
} from '@mui/material'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Public as PublicIcon,
  Lock as PrivateIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { useEndpoints } from '@TAF/state/selectors'
import { fetchEndpoints, deleteEndpoint } from '@TAF/actions/endpoints'
import { setActiveTeamId, setActiveRepoId } from '@TAF/state/accessors'

export type TRepoEndpoints = {}

export const RepoEndpoints = (props: TRepoEndpoints) => {
  const { teamId, repoId } = useParams<{ teamId: string; repoId: string }>()
  const navigate = useNavigate()
  const [endpoints] = useEndpoints()
  const [loading, setLoading] = useState(true)

  // Sync active team and repo with URL params
  useEffect(() => {
    if (teamId) setActiveTeamId(teamId)
    if (repoId) setActiveRepoId(repoId)
  }, [teamId, repoId])

  // Load endpoints for this repo
  useEffect(() => {
    const loadData = async () => {
      if (!repoId) return
      setLoading(true)
      await fetchEndpoints({ repoId })
      setLoading(false)
    }
    loadData()
  }, [repoId])

  // Filter endpoints for this repo
  const repoEndpoints = useMemo(() => {
    if (!endpoints || !repoId) return []
    return Object.values(endpoints).filter(endpoint => endpoint.repoId === repoId)
  }, [endpoints, repoId])

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete endpoint "${name}"?`)) {
      return
    }
    const result = await deleteEndpoint(id)
    if (result.error) {
      alert(`Failed to delete endpoint: ${result.error.message}`)
    }
  }

  const handleCreate = () => {
    navigate(`/teams/${teamId}/repos/${repoId}/endpoints/new`)
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-endpoints-page'>
        <Typography>Loading endpoints...</Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-endpoints-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant='h4' component='h1' sx={{ flex: 1 }}>
          Endpoints
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={handleCreate}
        >
          Create Endpoint
        </Button>
      </Box>

      {repoEndpoints.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color='text.secondary'>
              No endpoints found for this repository.
            </Typography>
            <Button
              variant='outlined'
              startIcon={<AddIcon />}
              onClick={handleCreate}
              sx={{ mt: 2 }}
            >
              Create Your First Endpoint
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Method</TableCell>
                <TableCell>Proxy URL</TableCell>
                <TableCell align='center'>Public</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repoEndpoints.map(endpoint => (
                <TableRow key={endpoint.id} hover>
                  <TableCell>{endpoint.name}</TableCell>
                  <TableCell>
                    <Chip
                      label={endpoint.method}
                      size='small'
                      color='primary'
                      variant='outlined'
                    />
                  </TableCell>
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                      sx={{ wordBreak: 'break-all' }}
                    >
                      {endpoint.proxyUrl}
                    </Typography>
                  </TableCell>
                  <TableCell align='center'>
                    {endpoint.public ? (
                      <Tooltip title='Public endpoint'>
                        <PublicIcon color='success' />
                      </Tooltip>
                    ) : (
                      <Tooltip title='Private endpoint'>
                        <PrivateIcon color='action' />
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell align='right'>
                    <Tooltip title='Delete endpoint'>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => handleDelete(endpoint.id, endpoint.name)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Page>
  )
}

export default RepoEndpoints
