import type { User } from '@tdsk/domain'

import { useParams } from 'react-router'
import { usersApi } from '@TAF/services'
import { Page } from '@TAF/pages/Page/Page'
import { EditRoleDialog } from './EditRoleDialog'
import { useEffect, useState, useMemo } from 'react'
import { InviteUserDialog } from './InviteUserDialog'
import { setActiveTeamId } from '@TAF/state/accessors'
import {
  SearchBar,
  PageHeader,
  EmptyState,
  FilterSelect,
  LoadingSpinner,
} from '@TAF/components'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material'

import {
  Box,
  Card,
  Grid,
  Chip,
  Alert,
  Avatar,
  Tooltip,
  IconButton,
  Typography,
  CardContent,
  CardActions,
} from '@mui/material'

export type TUserWithRole = User & {
  roleId?: string
  roleType?: 'super' | 'admin' | 'basic'
}

export type TTeamUsers = {}

// TODO: move to domain repo
const ROLE_FILTER_OPTIONS = [
  { value: 'super', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'basic', label: 'Basic' },
]

export const TeamUsers = (props: TTeamUsers) => {
  const { teamId } = useParams<{ teamId: string }>()
  const [users, setUsers] = useState<TUserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<TUserWithRole | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    if (teamId) {
      setActiveTeamId(teamId)
    }
  }, [teamId])

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

  const onOpenInviteDialog = () => {
    setInviteDialogOpen(true)
  }

  const onCloseInviteDialog = () => {
    setInviteDialogOpen(false)
  }

  const onInviteSuccess = () => {
    loadUsers()
    onCloseInviteDialog()
  }

  const onOpenEditRole = (user: TUserWithRole) => {
    setSelectedUser(user)
    setEditRoleDialogOpen(true)
  }

  const onCloseEditRole = () => {
    setSelectedUser(null)
    setEditRoleDialogOpen(false)
  }

  const onEditRoleSuccess = () => {
    loadUsers()
    onCloseEditRole()
  }

  const onRemoveUser = async (user: TUserWithRole) => {
    const displayName = user.displayName || user.email || 'this user'

    if (
      !window.confirm(`Are you sure you want to remove "${displayName}" from this team?`)
    ) {
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

  // Filter users based on search query and role filter
  const filteredUsers = useMemo(() => {
    let filtered = users

    // Apply role filter
    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.roleType === roleFilter)
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (user) =>
          user.displayName?.toLowerCase().includes(query) ||
          user.email?.toLowerCase().includes(query) ||
          user.first?.toLowerCase().includes(query) ||
          user.last?.toLowerCase().includes(query)
      )
    }

    return filtered
  }, [users, searchQuery, roleFilter])

  return (
    <Page className='tdsk-team-users-page'>
      <PageHeader
        title='Team Users'
        count={users.length}
        countLabel='member'
        actionLabel='Invite User'
        actionIcon={<PersonAddIcon />}
        onAction={onOpenInviteDialog}
      />

      {!loading && users.length > 0 && (
        <Box sx={{ mb: 3, display: 'flex', gap: 2 }}>
          <SearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder='Search users by name or email...'
            sx={{ flex: 1 }}
          />
          <FilterSelect
            id='role-filter'
            label='Role'
            value={roleFilter}
            onChange={setRoleFilter}
            options={ROLE_FILTER_OPTIONS}
            allLabel='All Roles'
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <Alert
          severity='error'
          sx={{ mb: 3 }}
          onClose={() => setError(null)}
        >
          Error loading users: {error.message}
        </Alert>
      )}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          message='No team members yet. Invite users to this team to get started.'
          actionLabel='Invite Your First User'
          actionIcon={<PersonAddIcon />}
          onAction={onOpenInviteDialog}
        />
      )}

      {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
        <EmptyState message='No users match your search or filter criteria.' />
      )}

      {!loading && !error && filteredUsers.length > 0 && (
        <Grid
          container
          spacing={3}
        >
          {filteredUsers.map((user) => (
            <Grid
              item
              xs={12}
              sm={6}
              md={4}
              key={user.id}
            >
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar
                      src={user.image}
                      sx={{ width: 56, height: 56, mr: 2 }}
                    >
                      {getInitials(user)}
                    </Avatar>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant='h6'
                        component='h3'
                      >
                        {user.displayName || `${user.first} ${user.last}`}
                      </Typography>
                      <Typography
                        variant='body2'
                        color='text.secondary'
                      >
                        {user.email}
                      </Typography>
                    </Box>
                  </Box>
                  <Box
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <Chip
                      label={getRoleLabel(user.roleType)}
                      color={getRoleColor(user.roleType)}
                      size='small'
                    />
                    <Typography
                      variant='caption'
                      color='text.secondary'
                    >
                      {user.provider || 'Email'}
                    </Typography>
                  </Box>
                </CardContent>
                <CardActions sx={{ justifyContent: 'flex-end', px: 2, pb: 2 }}>
                  <Tooltip title='Edit Role'>
                    <IconButton
                      size='small'
                      color='primary'
                      onClick={() => onOpenEditRole(user)}
                      disabled={user.roleType === 'super'}
                    >
                      <EditIcon />
                    </IconButton>
                  </Tooltip>
                  <Tooltip
                    title={
                      user.roleType === 'super'
                        ? 'Cannot remove super admin'
                        : 'Remove User'
                    }
                  >
                    <span>
                      <IconButton
                        size='small'
                        color='error'
                        onClick={() => onRemoveUser(user)}
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
        teamId={teamId || ''}
        open={inviteDialogOpen}
        onSuccess={onInviteSuccess}
        onClose={onCloseInviteDialog}
      />

      {selectedUser && (
        <EditRoleDialog
          user={selectedUser}
          teamId={teamId || ''}
          onClose={onCloseEditRole}
          open={editRoleDialogOpen}
          onSuccess={onEditRoleSuccess}
        />
      )}
    </Page>
  )
}

export default TeamUsers
