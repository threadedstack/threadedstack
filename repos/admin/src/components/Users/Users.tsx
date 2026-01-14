import type { User } from '@tdsk/domain'

import { usersApi } from '@TAF/services'
import { EditRoleDialog } from './EditRoleDialog'
import { NoUsers } from './NoUsers'
import { UsersGrid } from './UsersGrid'
import { useEffect, useState, useMemo } from 'react'
import { InviteUserDialog } from './InviteUserDialog'
import { setActiveOrgId } from '@TAF/state/accessors'
import { SearchBar, PageHeader, FilterSelect, LoadingSpinner } from '@TAF/components'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import { Box, Alert } from '@mui/material'

export type TUserWithRole = User & {
  roleId?: string
  roleType?: 'super' | 'admin' | 'basic'
}

export type TUsers = {
  orgId: string
}

// TODO: move to domain repo
const ROLE_FILTER_OPTIONS = [
  { value: 'super', label: 'Super Admin' },
  { value: 'admin', label: 'Admin' },
  { value: 'basic', label: 'Basic' },
]

export const Users = ({ orgId }: TUsers) => {
  const [users, setUsers] = useState<TUserWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<TUserWithRole | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<string>('all')

  useEffect(() => {
    if (orgId) {
      setActiveOrgId(orgId)
    }
  }, [orgId])

  const loadUsers = async () => {
    if (!orgId) return

    setLoading(true)
    setError(null)

    const resp = await usersApi.listByOrg(orgId)

    if (resp.error) {
      setError(resp.error)
    } else {
      setUsers(resp.data || [])
    }

    setLoading(false)
  }

  useEffect(() => {
    loadUsers()
  }, [orgId])

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
      !window.confirm(`Are you sure you want to remove "${displayName}" from this org?`)
    ) {
      return
    }

    if (!orgId || !user.roleId) return

    const resp = await usersApi.removeFromOrg(orgId, user.roleId)

    if (resp.error) {
      setError(resp.error)
    } else {
      loadUsers()
    }
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
    <>
      <PageHeader
        title='Org Users'
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
        <NoUsers onInvite={onOpenInviteDialog} />
      )}

      {!loading && !error && users.length > 0 && filteredUsers.length === 0 && (
        <Alert severity='info'>No users match your search or filter criteria.</Alert>
      )}

      {!loading && !error && filteredUsers.length > 0 && (
        <UsersGrid
          users={filteredUsers}
          onEditRole={onOpenEditRole}
          onRemoveUser={onRemoveUser}
        />
      )}

      <InviteUserDialog
        orgId={orgId}
        open={inviteDialogOpen}
        onSuccess={onInviteSuccess}
        onClose={onCloseInviteDialog}
      />

      {selectedUser && (
        <EditRoleDialog
          user={selectedUser}
          orgId={orgId}
          onClose={onCloseEditRole}
          open={editRoleDialogOpen}
          onSuccess={onEditRoleSuccess}
        />
      )}
    </>
  )
}

export default Users
