import type { User } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { ERoleType } from '@tdsk/domain'
import { useState, useEffect } from 'react'
import { ConfirmDelete } from '@tdsk/components'
import { AllAuthRoles } from '@TAF/constants/values'
import { NoUsers } from '@TAF/components/Users/NoUsers'
import { getInitials } from '@TAF/utils/user/getInitials'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
import { useUser, useActiveOrgId } from '@TAF/state/selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { useOrgUsersList } from '@TAF/hooks/org/useOrgUsersList'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { Box, Alert, Avatar, Chip, Typography } from '@mui/material'
import { EditUserDrawer } from '@TAF/components/Users/EditUserDrawer'
import { useLocalSearch } from '@TAF/hooks/components/useLocalSearch'
import { InviteUserDrawer } from '@TAF/components/Users/InviteUserDrawer'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
} from '@mui/icons-material'

export type TUsers = {}

const styles = {
  table: {
    actions: {
      box: {
        gap: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'end',
      },
      icon: { fontSize: '16px' },
    },
  },
}

export const Users = (props: TUsers) => {
  const [orgId] = useActiveOrgId()
  const [authUser] = useUser()
  const [roleFilter, setRoleFilter] = useState<string>('all')
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)

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

  const onEditUser = (user: User) => {
    setSelectedUser(user)
  }

  const onCloseEditUser = () => {
    setSelectedUser(null)
  }

  const onEditUserSuccess = () => {
    loadUsers()
  }

  const onRemoveUser = (user: User) => setRemovingUser(user)

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
          user?.displayName?.toLowerCase().includes(cleaned) ||
          user?.email?.toLowerCase().includes(cleaned) ||
          user?.first?.toLowerCase().includes(cleaned) ||
          user?.last?.toLowerCase().includes(cleaned)
      )

      return filtered
    },
  })

  useEffect(() => onSearch(), [roleFilter])

  const hasUser = Boolean(users.length)

  const columns: TDataTableColumn<User>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (user) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            src={user.image}
            sx={{ width: 36, height: 36 }}
          >
            {getInitials(user)}
          </Avatar>
          <Typography
            variant='body2'
            fontWeight='medium'
          >
            {user.displayName ||
              [user.first, user.last].filter(Boolean).join(' ') ||
              user.email ||
              'User'}
          </Typography>
        </Box>
      ),
    },
    {
      id: 'email',
      label: 'Email',
      render: (user) => (
        <Typography
          variant='body2'
          color='text.secondary'
          sx={{
            maxWidth: 250,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {user.email || '\u2014'}
        </Typography>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      render: (user) => (
        <Chip
          size='small'
          color={getRoleColor(user.role as ERoleType)}
          label={(user.role || ERoleType.viewer)?.toUpperCase()}
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (user) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            tooltip='Edit'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            size='small'
            color='primary'
            disabled={authUser.role === ERoleType.viewer}
            disabledTooltip='Viewers cannot edit users'
            onClick={(e) => {
              e.stopPropagation()
              onEditUser(user)
            }}
          />
          <ActionIconButton
            tooltip='Remove User'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            size='small'
            color='error'
            disabled={user.role === ERoleType.super || authUser.id === user.id}
            disabledTooltip={
              user.role === ERoleType.super
                ? 'Cannot remove super admin'
                : 'Cannot remove yourself'
            }
            onClick={(e) => {
              e.stopPropagation()
              onRemoveUser(user)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      error={error}
      title='Members'
      query={query}
      loading={loading}
      setError={setError}
      countLabel='member'
      count={users.length}
      filterValue={roleFilter}
      onFilter={setRoleFilter}
      filterOpts={AllAuthRoles}
      filterAllLabel='All Roles'
      setSearchQuery={onChange}
      searchCount={items.length}
      actionIcon={<PersonAddIcon />}
      onAction={hasUser && onOpenInviteDialog}
      actionLabel={hasUser && 'Invite User'}
      searchPlaceholder='Search users by name or email...'
    >
      {!loading && !error && users.length === 0 && (
        <NoUsers onInvite={onOpenInviteDialog} />
      )}

      {!loading && !error && users.length > 0 && items.length === 0 && (
        <Alert severity='info'>No users match your search or filter criteria.</Alert>
      )}

      {!loading && !error && items.length > 0 && (
        <DataTable
          columns={columns}
          data={items}
          onRowClick={onEditUser}
          getRowKey={(user) => user.id}
        />
      )}

      <InviteUserDrawer
        orgId={orgId}
        open={inviteDialogOpen}
        onSuccess={onInviteSuccess}
        onClose={onCloseInviteDialog}
      />

      {selectedUser && (
        <EditUserDrawer
          orgId={orgId}
          user={selectedUser}
          onRemove={onRemoveUser}
          onClose={onCloseEditUser}
          open={Boolean(selectedUser)}
          onSuccess={onEditUserSuccess}
        />
      )}

      <ConfirmDelete
        deleting={loading}
        title={`Remove user?`}
        open={Boolean(removingUser)}
        itemName={removingUser?.displayName}
        onCancel={() => setRemovingUser(null)}
        onConfirm={() => removeUser(removingUser)}
        text={`Are you sure you want to remove "${removingUser?.displayName}" from the organization?`}
      />
    </PageLayout>
  )
}

export default Users
