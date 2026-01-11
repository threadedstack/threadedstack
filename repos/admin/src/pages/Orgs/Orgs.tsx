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
import { useOrgs } from '@TAF/state/selectors'
import { CreateOrgDialog } from './CreateOrgDialog'
import { fetchOrgs, deleteOrg } from '@TAF/actions/orgs'

export type TOrgs = {}

export const Orgs = (props: TOrgs) => {
  const [orgs] = useOrgs()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)

  useEffect(() => {
    const loadOrgs = async () => {
      setLoading(true)
      await fetchOrgs()
      setLoading(false)
    }
    loadOrgs()
  }, [])

  const handleCreateClick = () => {
    setCreateDialogOpen(true)
  }

  const handleViewOrg = (orgId: string) => {
    navigate(`/orgs/${orgId}`)
  }

  const handleDeleteOrg = async (orgId: string, orgName: string) => {
    if (!window.confirm(`Are you sure you want to delete org "${orgName}"?`)) {
      return
    }
    await deleteOrg(orgId)
  }

  const orgsArray = orgs ? Object.values(orgs) : []

  return (
    <Page className='tdsk-orgs-page'>
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
          Orgs
        </Typography>
        <Button
          variant='contained'
          color='primary'
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
        >
          Create Org
        </Button>
      </Box>

      {loading && <Typography>Loading orgs...</Typography>}

      {!loading && orgsArray.length === 0 && (
        <Card>
          <CardContent>
            <Typography
              color='text.secondary'
              align='center'
            >
              No orgs yet. Create your first org to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && orgsArray.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {orgsArray.map((org) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={org.id}
            >
              <Card>
                <CardContent>
                  <Typography
                    variant='h6'
                    component='h2'
                    gutterBottom
                  >
                    {org.name}
                  </Typography>
                  <Typography
                    color='text.secondary'
                    variant='body2'
                  >
                    {org.description || 'No description'}
                  </Typography>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ mt: 1, display: 'block' }}
                  >
                    ID: {org.id}
                  </Typography>
                </CardContent>
                <CardActions sx={{ justifyContent: 'space-between', px: 2, pb: 2 }}>
                  <Tooltip title='View Org'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => handleViewOrg(org.id)}
                    >
                      <ViewIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title='Delete Org'>
                    <IconButton
                      size='small'
                      color='error'
                      onClick={() => handleDeleteOrg(org.id, org.name)}
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

      <CreateOrgDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
      />
    </Page>
  )
}

export default Orgs
