import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActions,
  Grid,
  Button,
  IconButton,
  Tooltip,
  Avatar,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material'
import {
  PersonAdd as PersonAddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'
import { Page } from '@TAF/pages/Page/Page'
import { setActiveTeamId } from '@TAF/state/accessors'
import { usersApi } from '@TAF/services'
import type { User } from '@tdsk/domain'
import { InviteUserDialog } from './InviteUserDialog'
import { EditRoleDialog } from './EditRoleDialog'

export type TUserWithRole = User & {
  roleId?: string
  roleType?: 'super' | 'admin' | 'basic'
}

export type TTeamUsers = {}

export const TeamUsers = (props: TTeamUsers) => {
  const { teamId } = useParams<{ teamId: string }>()
  const [users, setUsers] = useState<TUserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<TUserWithRole | null>(null)

  // Sync active team with URL params
  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

  // Load team users
  const loadUsers = async () => {
    if (!teamId) return

    setLoading(true)
    setError(null)

    const resp = await usersApi.listByTeam(teamId)

    if (resp.error) {
      setError(resp.error)
    } else {
      setUsers(resp.data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [teamId])

  const handleOpenInviteDialog = () => {
    setInviteDialogOpen(true)
  }

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false)
  }

  const handleInviteSuccess = () => {
    loadUsers()
    handleCloseInviteDialog()
  }

  const handleOpenEditRole = (user: TUserWithRole) => {
    setSelectedUser(user)
    setEditRoleDialogOpen(true)
  }

  const handleCloseEditRole = () => {
    setSelectedUser(null)
    setEditRoleDialogOpen(false)
  }

  const handleEditRoleSuccess = () => {
    loadUsers()
    handleCloseEditRole()
  }

  const handleRemoveUser = async (user: TUserWithRole) => {
    const displayName = user.displayName || user.email || 'this user'

    if (!window.confirm(`Are you sure you want to remove "${displayName}" from this team?`)) {
      return
    }

    if (!teamId || !user.roleId) return

    const resp = await usersApi.removeFromTeam(teamId, user.roleId)

    if (resp.error) {
      setError(resp.error)
    } else {
      loadUsers()
    }
  }

  const getRoleColor = (roleType?: string) => {
    switch (roleType) {
      case 'super':
        return 'error'
      case 'admin':
        return 'warning'
      case 'basic':
      default:
        return 'default'
    }
  }

  const getRoleLabel = (roleType?: string) => {
    return roleType?.toUpperCase() || 'BASIC'
  }

  const getInitials = (user: TUserWithRole) => {
    if (user.first && user.last) {
      return `${user.first[0]}${user.last[0]}`.toUpperCase()
    }
    if (user.displayName) {
      const parts = user.displayName.split(' ')
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      }
      return user.displayName.substring(0, 2).toUpperCase()
    }
    if (user.email) {
      return user.email.substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  return (
    <Page className='tdsk-team-users-page'>
      <Box
        sx={{
          mb: 3,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Typography variant='h4' component='h1'>
            Team Users
          </Typography>
          <Typography color='text.secondary' variant='body2'>
            Manage team members and their roles
          </Typography>
        </Box>
        <Button
          variant='contained'
          color='primary'
          startIcon={<PersonAddIcon />}
          onClick={handleOpenInviteDialog}
        >
          Invite User
        </Button>
      </Box>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
          Error loading users: {error.message}
        </Alert>
      )}

      {!loading && !error && users.length === 0 && (
        <Card>
          <CardContent>
            <Typography color='text.secondary' align='center'>
              No team members yet. Invite users to this team to get started.
            </Typography>
          </CardContent>
        </Card>
      )}

      {!loading && !error && users.length > 0 && (
        <Grid container spacing={3}>
          {users.map((user) => (
            <Grid item xs={12} sm={6} md={4} key={user.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      src={user.photoUrl}
                      sx={{ width: 56, height: 56, mr: 2 }}
                    >
                      {getInitials(user)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography variant='h6' component='h3'>
                        {user.displayName || `${user.first} ${user.last}`}
                      </Typography>
                      <Typography variant='body2' color='text.secondary'>
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip
                      label={getRoleLabel(user.roleType)}
                      color={getRoleColor(user.roleType)}
                      size='small'
                    />
                    <Typography variant='caption' color='text.secondary'>
                      {user.provider || 'Email'}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                  <Tooltip title='Edit Role'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => handleOpenEditRole(user)}
                      disabled={user.roleType === 'super'}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={user.roleType === 'super' ? 'Cannot remove super admin' : 'Remove User'}>
                    <span>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => handleRemoveUser(user)}
                        disabled={user.roleType === 'super'}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </span>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <InviteUserDialog
        open={inviteDialogOpen}
        teamId={teamId || ''}
        onClose={handleCloseInviteDialog}
        onSuccess={handleInviteSuccess}
      />

      {selectedUser && (
        <EditRoleDialog
          open={editRoleDialogOpen}
          teamId={teamId || ''}
          user={selectedUser}
          onClose={handleCloseEditRole}
          onSuccess={handleEditRoleSuccess}
        />
      )}
    </Page>
  )
}

export default TeamUsers
