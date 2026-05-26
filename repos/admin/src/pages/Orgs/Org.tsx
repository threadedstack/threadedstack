import { useState } from 'react'
import { ERoutePath } from '@TAF/types'
import { ERoleType } from '@tdsk/domain'
import { useNavigate } from 'react-router'
import { Page } from '@TAF/pages/Page/Page'
import { useActiveOrg } from '@TAF/state/selectors'
import { ConfirmDelete, OrgIcon } from '@tdsk/components'
import { getInitials } from '@TAF/utils/user/getInitials'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
import { deleteOrg } from '@TAF/actions/orgs/api/deleteOrg'
import { OnboardingWizard } from '@TAF/components/Onboarding'
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch'
import { useOrgUsersList } from '@TAF/hooks/org/useOrgUsersList'
import { EditOrgDrawer } from '@TAF/components/Orgs/EditOrgDrawer'
import { ActionCards } from '@TAF/components/ActionCards/ActionCards'
import { openOnboarding } from '@TAF/actions/onboarding/local/openOnboarding'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  VpnKey as SecretIcon,
  FolderOpen as ProjectIcon,
  PersonAdd as AddMemberIcon,
} from '@mui/icons-material'
import {
  Box,
  Card,
  Chip,
  List,
  Avatar,
  Button,
  Divider,
  ListItem,
  Typography,
  CardContent,
  ListItemText,
  ListItemAvatar,
  CircularProgress,
} from '@mui/material'

export type TOrg = {}

export const Org = (props: TOrg) => {
  const [org] = useActiveOrg()
  const navigate = useNavigate()
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [editDrawerOpen, setEditDrawerOpen] = useState(false)
  const { users: orgUsers, loading: membersLoading } = useOrgUsersList()

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

      <ActionCards
        hideHeader
        sx={{ mb: 3 }}
        title='Quick Actions'
        actions={[
          {
            title: `Setup Wizard`,
            Icon: RocketLaunchIcon,
            onClick: () =>
              openOnboarding({
                mode: `manual`,
                orgId: org.id,
                startStep: 1,
              }),
            subtitle: `Configure providers, projects & sandboxes`,
          },
          {
            title: `Projects`,
            Icon: ProjectIcon,
            subtitle: `View and manage projects`,
            onClick: () => navigate(`/orgs/${org.id}/projects`),
          },
          {
            Icon: AddMemberIcon,
            title: `Invite Users`,
            subtitle: `Manage team members`,
            onClick: () => navigate(`/orgs/${org.id}/members`),
          },
          {
            Icon: SecretIcon,
            title: `Manage Secrets`,
            subtitle: `Configure API keys and secrets`,
            onClick: () => navigate(`/orgs/${org.id}/secrets`),
          },
        ]}
      />

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 2,
            }}
          >
            <Typography variant='h6'>
              Org Members
              {!membersLoading && orgUsers.length > 0 && ` (${orgUsers.length})`}
            </Typography>
            <Button
              variant='outlined'
              size='small'
              startIcon={<AddMemberIcon />}
              onClick={() => navigate(`/orgs/${org.id}/members`)}
            >
              Manage Members
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {membersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : orgUsers.length === 0 ? (
            <Typography
              color='text.secondary'
              align='center'
            >
              No members yet. Invite users from the Members page.
            </Typography>
          ) : (
            <>
              <List disablePadding>
                {orgUsers.slice(0, 5).map((user) => (
                  <ListItem
                    key={user.id}
                    sx={{ px: 0 }}
                  >
                    <ListItemAvatar>
                      <Avatar
                        src={user.image}
                        sx={{ width: 36, height: 36 }}
                      >
                        {getInitials(user)}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        user.displayName ||
                        [user.first, user.last].filter(Boolean).join(' ') ||
                        user.email ||
                        'User'
                      }
                      secondary={user.email}
                    />
                    <Chip
                      size='small'
                      color={getRoleColor(user.role as ERoleType)}
                      label={(user.role || ERoleType.member)?.toUpperCase()}
                    />
                  </ListItem>
                ))}
              </List>
              {orgUsers.length > 5 && (
                <Button
                  size='small'
                  onClick={() => navigate(`/orgs/${org.id}/members`)}
                  sx={{ mt: 1 }}
                >
                  View all {orgUsers.length} members
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

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

      <OnboardingWizard />
    </Page>
  )
}

export default Org
