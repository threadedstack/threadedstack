import { useState } from 'react'
import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { useActiveOrg } from '@TAF/state/selectors'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { EditOrgDrawer } from '@TAF/components/Orgs/EditOrgDrawer'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as AddMemberIcon,
  VpnKey as SecretIcon,
  FolderOpen as ProjectIcon,
} from '@mui/icons-material'
import { Box, Card, Grid, Button, Divider, Typography, CardContent } from '@mui/material'

export type TOrg = {}

export const Org = (props: TOrg) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)

  const onEditClick = () => setEditDrawerOpen(true)
  const onEditSuccess = () => setEditDrawerOpen(false)
  const onDeleteClick = () => setDeleteDialogOpen(true)
  const onDeleteCancel = () => setDeleteDialogOpen(false)
  const onEditDrawerClose = () => setEditDrawerOpen(false)

  const onDelete = async () => {
    if (!org?.id) return
    const result = await deleteOrg(org.id)
    !result.error && navigate(ERoutePath.Orgs)
    setDeleteDialogOpen(false)
  }

  if (!org) {
    return (
      <Page className='tdsk-org-page'>
        <Card>
          <CardContent>
            <Typography color='error'>Org not found</Typography>
            <Button
              onClick={() => navigate(ERoutePath.Orgs)}
              sx={{ mt: 2 }}
            >
              Back to Orgs
            </Button>
          </CardContent>
        </Card>
      </Page>
    )
  }

  return (
    <Page className='tdsk-org-page'>
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <OrgIcon sx={{ color: 'text.secondary' }} />
        <Typography
          variant='h4'
          component='h1'
          sx={{ flex: 1 }}
        >
          {org.name}
        </Typography>
        <Button
          variant='outlined'
          startIcon={<EditIcon />}
          onClick={onEditClick}
        >
          Edit
        </Button>
        <Button
          color='error'
          variant='outlined'
          onClick={onDeleteClick}
          startIcon={<DeleteIcon />}
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
            Org Information
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Name
            </Typography>
            <Typography variant='body1'>{org.name}</Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Description
            </Typography>
            <Typography variant='body1'>
              {org.description || 'No description provided'}
            </Typography>
          </Box>

          <Box sx={{ mb: 2 }}>
            <Typography
              variant='subtitle2'
              color='text.secondary'
            >
              Org ID
            </Typography>
            <Typography
              variant='body2'
              fontFamily='monospace'
            >
              {org.id}
            </Typography>
          </Box>

          {org.createdAt && (
            <Box sx={{ mb: 2 }}>
              <Typography
                variant='subtitle2'
                color='text.secondary'
              >
                Created At
              </Typography>
              <Typography variant='body2'>
                {new Date(org.createdAt).toLocaleString()}
              </Typography>
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
              <Typography variant='body2'>
                {new Date(org.updatedAt).toLocaleString()}
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography
            variant='h6'
            gutterBottom
          >
            Quick Actions
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Grid
            container
            spacing={2}
          >
            <Grid
              item
              xs={12}
              sm={4}
            >
              <Card
                variant='outlined'
                sx={{
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' },
                }}
                onClick={() => navigate(`/orgs/${org.id}/projects`)}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <ProjectIcon
                    color='primary'
                    sx={{ fontSize: 40 }}
                  />
                  <Typography
                    variant='subtitle1'
                    sx={{ mt: 1 }}
                  >
                    Projects
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    View and manage projects
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid
              item
              xs={12}
              sm={4}
            >
              <Card
                variant='outlined'
                sx={{
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' },
                }}
                onClick={() => navigate(`/orgs/${org.id}/users`)}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <AddMemberIcon
                    color='primary'
                    sx={{ fontSize: 40 }}
                  />
                  <Typography
                    variant='subtitle1'
                    sx={{ mt: 1 }}
                  >
                    Invite Users
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    Manage team members
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid
              item
              xs={12}
              sm={4}
            >
              <Card
                variant='outlined'
                sx={{
                  cursor: 'pointer',
                  '&:hover': { borderColor: 'primary.main' },
                }}
                onClick={() => navigate(`/orgs/${org.id}/secrets`)}
              >
                <CardContent sx={{ textAlign: 'center' }}>
                  <SecretIcon
                    color='primary'
                    sx={{ fontSize: 40 }}
                  />
                  <Typography
                    variant='subtitle1'
                    sx={{ mt: 1 }}
                  >
                    Manage Secrets
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                  >
                    Configure API keys and secrets
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
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
            <Typography variant='h6'>Org Members</Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<AddMemberIcon />}
              onClick={() => navigate(`/orgs/${org.id}/users`)}
            >
              Manage Members
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          <Typography
            color='text.secondary'
            align='center'
          >
            Visit the Users page to invite and manage organization members.
          </Typography>
        </CardContent>
      </Card>

      <ConfirmDelete
        onConfirm={onDelete}
        itemName={org?.name}
        open={deleteDialogOpen}
        onCancel={onDeleteCancel}
        title='Delete Organization?'
        warnText='This will permanently delete the organization and all its associated projects, endpoints, functions, and secrets.'
      />

      <EditOrgDrawer
        org={org}
        open={editDrawerOpen}
        onSuccess={onEditSuccess}
        onClose={onEditDrawerClose}
      />
    </Page>
  )
}

export default Org
