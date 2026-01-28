import { useState } from 'react'
import { ERoutePath } from '@TAF/types'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { useActiveOrg } from '@TAF/state/selectors'
import { OrgIcon } from '@TAF/components/Orgs/OrgIcon'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { Box, Card, Button, Divider, Typography, CardContent } from '@mui/material'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as AddMemberIcon,
} from '@mui/icons-material'

export type TOrg = {}

export const Org = (props: TOrg) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)

  const onDeleteClick = () => setDeleteDialogOpen(true)
  const onDeleteCancel = () => setDeleteDialogOpen(false)

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

      <ConfirmDelete
        onConfirm={onDelete}
        itemName={org?.name}
        open={deleteDialogOpen}
        onCancel={onDeleteCancel}
        title='Delete Organization?'
        warnText='This will permanently delete the organization and all its associated projects, endpoints, functions, and secrets.'
      />
    </Page>
  )
}

export default Org
