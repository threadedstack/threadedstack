import type { PermissionOverride } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import { useState, useMemo } from 'react'
import { Text, ConfirmDelete } from '@tdsk/components'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { usePermissionOverrides, useOrgUsers } from '@TAF/state/selectors'
import { deleteOverride } from '@TAF/actions/permissionOverrides/api/deleteOverride'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { PermissionOverrideDrawer } from '@TAF/components/PermissionOverrides/PermissionOverrideDrawer'
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material'

export type PermissionOverrides = {
  orgId: string
  users: Array<{ id: string; name: string; email?: string }>
}

const styles = {
  table: {
    actions: {
      icon: { fontSize: `16px` },
      box: {
        gap: 1.5,
        display: `flex`,
        alignItems: `center`,
        justifyContent: `end`,
      },
    },
  },
}

export const PermissionOverrides = (props: PermissionOverrides) => {
  const { orgId, users } = props

  const [overrides] = usePermissionOverrides()
  const overridesList = useMemo(() => overrides || [], [overrides])

  const [error, setError] = useState<Error>()
  const [loading, setLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<PermissionOverride>()
  const [deleting, setDeleting] = useState<PermissionOverride>()

  const userMap = useMemo(() => {
    const map: Record<string, { name: string; email?: string }> = {}
    for (const u of users) {
      map[u.id] = { name: u.name, email: u.email }
    }
    return map
  }, [users])

  const onCreateOverride = () => {
    setEditing(undefined)
    setDrawerOpen(true)
  }

  const onDrawerClose = () => {
    setDrawerOpen(false)
    setEditing(undefined)
  }

  const onRemove = async () => {
    if (!deleting) return

    setLoading(true)
    setError(undefined)

    const result = await deleteOverride({ orgId, overrideId: deleting.id })

    if (result.error) {
      setError(
        result.error instanceof Error ? result.error : new Error(String(result.error))
      )
      toast.error(`Failed to delete permission override`)
    } else {
      toast.success(`Permission override deleted`)
    }

    setLoading(false)
    setDeleting(undefined)
  }

  const filteredOverrides = useMemo(() => {
    if (!searchQuery.trim()) return overridesList

    const query = searchQuery.toLowerCase()
    return overridesList.filter((override) => {
      const user = userMap[override.userId]
      return (
        override.permission?.toLowerCase().includes(query) ||
        override.effect?.toLowerCase().includes(query) ||
        override.reason?.toLowerCase().includes(query) ||
        user?.name?.toLowerCase().includes(query) ||
        user?.email?.toLowerCase().includes(query) ||
        override.userId?.toLowerCase().includes(query)
      )
    })
  }, [overridesList, searchQuery, userMap])

  const columns: TDataTableColumn<PermissionOverride>[] = [
    {
      id: 'user',
      label: 'User',
      render: (override) => {
        const user = userMap[override.userId]
        return (
          <Box>
            <Text
              variant='body2'
              fontWeight='medium'
            >
              {user?.name || override.userId}
            </Text>
            {user?.email && (
              <Text
                variant='caption'
                color='text.secondary'
                display='block'
              >
                {user.email}
              </Text>
            )}
          </Box>
        )
      },
    },
    {
      id: 'permission',
      label: 'Permission',
      render: (override) => (
        <Text
          variant='body2'
          sx={{ fontFamily: 'monospace' }}
        >
          {override.permission}
        </Text>
      ),
    },
    {
      id: 'effect',
      label: 'Effect',
      width: 100,
      render: (override) => (
        <Chip
          size='small'
          variant='outlined'
          label={override.effect === `grant` ? `Grant` : `Deny`}
          color={override.effect === `grant` ? `success` : `error`}
        />
      ),
    },
    {
      id: 'reason',
      label: 'Reason',
      render: (override) => (
        <Text
          variant='body2'
          color='text.secondary'
          sx={{
            maxWidth: 200,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {override.reason || '-'}
        </Text>
      ),
    },
    {
      id: 'expiresAt',
      label: 'Expires At',
      width: 150,
      render: (override) => (
        <Text
          variant='body2'
          color='text.secondary'
        >
          {override.expiresAt
            ? new Date(override.expiresAt).toLocaleDateString()
            : 'Never'}
        </Text>
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (override) => (
        <Box sx={styles.table.actions.box}>
          <ActionIconButton
            size='small'
            color='primary'
            tooltip='Edit Override'
            icon={<EditIcon sx={styles.table.actions.icon} />}
            onClick={(e) => {
              e.stopPropagation()
              setEditing(override)
              setDrawerOpen(true)
            }}
          />
          <ActionIconButton
            size='small'
            color='error'
            tooltip='Delete Override'
            icon={<DeleteIcon sx={styles.table.actions.icon} />}
            onClick={(e) => {
              e.stopPropagation()
              setDeleting(override)
            }}
          />
        </Box>
      ),
    },
  ]

  return (
    <PageLayout
      searchCount={0}
      loading={loading}
      query={searchQuery}
      countLabel='override'
      error={error?.message}
      actionIcon={<AddIcon />}
      title='Permission Overrides'
      count={overridesList.length}
      setSearchQuery={setSearchQuery}
      onAction={overridesList.length > 0 && onCreateOverride}
      actionLabel={overridesList.length > 0 && 'Add Override'}
      searchPlaceholder='Search by user, permission, or reason...'
      setError={(msg?: string) => setError(msg ? new Error(msg) : undefined)}
    >
      {!error && overridesList.length === 0 && !loading && (
        <EmptyState
          actionIcon={<AddIcon />}
          actionLabel='Add Override'
          onAction={onCreateOverride}
          message='No permission overrides yet. Add an override to grant or deny specific permissions for a user.'
        />
      )}

      {!error && overridesList.length > 0 && filteredOverrides.length === 0 && (
        <EmptyState message='No overrides match your search query.' />
      )}

      {!error && filteredOverrides.length > 0 && (
        <DataTable
          columns={columns}
          data={filteredOverrides}
          getRowKey={(override) => override.id}
        />
      )}

      {orgId && (
        <PermissionOverrideDrawer
          orgId={orgId}
          users={users}
          open={drawerOpen}
          editing={editing}
          onClose={onDrawerClose}
        />
      )}

      {deleting && (
        <ConfirmDelete
          deleting={loading}
          onConfirm={onRemove}
          onCancel={() => setDeleting(undefined)}
          itemName={`permission override for ${deleting.permission}`}
        />
      )}
    </PageLayout>
  )
}

export default PermissionOverrides
