import { Page } from '@TAF/pages/Page/Page'
import { useSecrets } from '@TAF/state/selectors'
import { useEffect, useState, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router'
import { fetchSecrets, deleteSecret } from '@TAF/actions/secrets'
import { setActiveOrgId, setActiveRepoId } from '@TAF/state/accessors'
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Visibility as VisibilityIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Table,
  Button,
  Tooltip,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
  Typography,
  CardContent,
  IconButton,
  TableContainer,
} from '@mui/material'

export type TRepoSecrets = {}

export const RepoSecrets = (props: TRepoSecrets) => {
  const { orgId, repoId } = useParams<{ orgId: string; repoId: string }>()
  const navigate = useNavigate()
  const [secrets] = useSecrets()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (orgId) setActiveOrgId(orgId)
    if (repoId) setActiveRepoId(repoId)
  }, [orgId, repoId])

  useEffect(() => {
    const loadData = async () => {
      if (!repoId) return
      setLoading(true)
      await fetchSecrets({ repoId })
      setLoading(false)
    }
    loadData()
  }, [repoId])

  const repoSecrets = useMemo(() => {
    if (!secrets || !repoId) return []
    return Object.values(secrets).filter((secret) => secret.repoId === repoId)
  }, [secrets, repoId])

  const onDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete secret "${name}"?`)) {
      return
    }
    const result = await deleteSecret(id)
    if (result.error) {
      alert(`Failed to delete secret: ${result.error.message}`)
    }
  }

  const onCreate = () => {
    navigate(`/orgs/${orgId}/repos/${repoId}/secrets/new`)
  }

  if (loading) {
    return (
      <Page className='tdsk-repo-secrets-page'>
        <Typography>Loading secrets...</Typography>
      </Page>
    )
  }

  return (
    <Page className='tdsk-repo-secrets-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          Secrets
        </Typography>
        <Button
          variant='contained'
          startIcon={<AddIcon />}
          onClick={onCreate}
        >
          Create Secret
        </Button>
      </Box>

      {repoSecrets.length === 0 ? (
        <Card>
          <CardContent>
            <Typography color='text.secondary'>
              No secrets found for this repository.
            </Typography>
            <Button
              variant='outlined'
              startIcon={<AddIcon />}
              onClick={onCreate}
              sx={{ mt: 2 }}
            >
              Create Your First Secret
            </Button>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Card}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Value</TableCell>
                <TableCell>Created At</TableCell>
                <TableCell align='right'>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {repoSecrets.map((secret) => (
                <TableRow
                  key={secret.id}
                  hover
                >
                  <TableCell>
                    <Typography
                      variant='body2'
                      fontFamily='monospace'
                    >
                      {secret.name}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography
                        variant='body2'
                        fontFamily='monospace'
                        color='text.secondary'
                      >
                        ••••••••
                      </Typography>
                      <Tooltip title='Values are never displayed for security'>
                        <VisibilityIcon
                          fontSize='small'
                          color='disabled'
                        />
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {secret.createdAt
                      ? new Date(secret.createdAt).toLocaleString()
                      : 'N/A'}
                  </TableCell>
                  <TableCell align='right'>
                    <Tooltip title='Delete secret'>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => onDelete(secret.id, secret.name)}
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

export default RepoSecrets
