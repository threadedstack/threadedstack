import type { User } from '@tdsk/domain'

import { Box, Alert } from '@mui/material'
import { useState, useEffect } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import { AllAuthRoles } from '@TAF/constants/values'
import { useActiveOrgId } from '@TAF/state/selectors'
import { NoUsers } from '@TAF/components/Users/NoUsers'
import { UsersGrid } from '@TAF/components/Users/UsersGrid'
import { useOrgUsersList } from '@TAF/hooks/org/useOrgUsersList'
import { PersonAdd as PersonAddIcon } from '@mui/icons-material'
import { EditRoleDrawer } from '@TAF/components/Roles/EditRoleDrawer'
import { useLocalSearch } from '@TAF/hooks/components/useLocalSearch'
import { InviteUserDrawer } from '@TAF/components/Users/InviteUserDrawer'
import {
  SearchBar,
  PageHeader,
  ErrorAlert,
  FilterSelect,
  LoadingSpinner,
} from '@TAF/components'

export type TUsers = {}

export const Users = (props: TUsers) => {
  const [orgId] = useActiveOrgId()
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [editRoleDialogOpen, setEditRoleDialogOpen] = useState(false)

  const [removingUser, setRemovingUser] = useState<User | null>(null)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const { users, error, loading, setError, loadUsers, removeUser } = useOrgUsersList()

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

  const onOpenEditRole = (user: User) => {
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

  const { items, query, onChange, onSearch } = useLocalSearch<User>({
    items: users,
    onQuery: (query, current, initial) => {
      const cleaned = query.trim().toLowerCase()
      if (!cleaned) return initial

      let filtered = initial

      if (roleFilter !== `all`)
        filtered = filtered.filter((user) => user.role === roleFilter)

      filtered = filtered.filter(
        (user) =>
          user.displayName?.toLowerCase().includes(cleaned) ||
          user.email?.toLowerCase().includes(cleaned) ||
          user.first?.toLowerCase().includes(cleaned) ||
          user.last?.toLowerCase().includes(cleaned)
      )

      return filtered
    },
  })

  useEffect(() => onSearch(), [roleFilter])

  return (
    <>
      <PageHeader
        count={users.length}
        countLabel='member'
        actionLabel='Invite User'
        title='Organization Users'
        actionIcon={<PersonAddIcon />}
        onAction={onOpenInviteDialog}
      />

      {!loading && users.length > 0 && (
        <Box sx={{ mb: 5, display: 'flex', gap: 2 }}>
          <SearchBar
            sx={{ flex: 1 }}
            value={query}
            id='user-search-bar'
            onChange={onChange}
            placeholder='Search users by name or email...'
          />
          <FilterSelect
            id='role-filter'
            value={roleFilter}
            allLabel='All Roles'
            options={AllAuthRoles}
            onChange={setRoleFilter}
          />
        </Box>
      )}

      {loading && <LoadingSpinner />}

      {error && (
        <ErrorAlert
          message={`Error loading users: ${error}`}
          onClose={() => setError(null)}
          sx={{ mb: 3 }}
        />
      )}

      {!loading && !error && users.length === 0 && (
        <NoUsers onInvite={onOpenInviteDialog} />
      )}

      {!loading && !error && users.length > 0 && items.length === 0 && (
        <Alert severity='info'>No users match your search or filter criteria.</Alert>
      )}

      {!loading && !error && items.length > 0 && (
        <UsersGrid
          users={items}
          onEditRole={onOpenEditRole}
          onRemoveUser={(user) => setRemovingUser(user)}
        />
      )}

      <InviteUserDrawer
        orgId={orgId}
        open={inviteDialogOpen}
        onSuccess={onInviteSuccess}
        onClose={onCloseInviteDialog}
      />

      {selectedUser && (
        <EditRoleDrawer
          orgId={orgId}
          user={selectedUser}
          onClose={onCloseEditRole}
          open={editRoleDialogOpen}
          onSuccess={onEditRoleSuccess}
        />
      )}

      <ConfirmDelete
        deleting={loading}
        title={`Remove user?`}
        open={Boolean(removingUser)}
        itemName={removingUser.displayName}
        onConfirm={() => removeUser(removingUser)}
        onCancel={() => setRemovingUser(undefined)}
        text={`Are you sure you want to remove "${removingUser.displayName}" from the organization?`}
      />
    </>
  )
}

export default Users
