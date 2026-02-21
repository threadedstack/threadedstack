import type { User, TRoleType, Role } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { useState, useEffect, useMemo } from 'react'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { projectMembersApi } from '@TAF/services/projectMembersApi'
import { usersApi } from '@TAF/services/usersApi'
import { Box, Chip, Typography, Autocomplete, TextField } from '@mui/material'
import { PersonAdd as PersonAddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Drawer, DrawerActions } from '@tdsk/components'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'

type TProjectMember = {
  userId: string
  role: TRoleType
  displayName?: string
  email?: string
}

export const ProjectMembers = () => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [orgUsers, setOrgUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState('member')
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<TProjectMember | null>(null)

  const loadMembers = async () => {
    if (!orgId || !projectId) return
    setLoading(true)
    try {
      const resp = await projectMembersApi.list(orgId, projectId)
      if (resp.data) setRoles(resp.data)
    } finally {
      setLoading(false)
    }
  }

  const loadOrgUsers = async () => {
    if (!orgId) return
    try {
      const resp = await usersApi.listByOrg(orgId)
      if (resp.data) setOrgUsers(resp.data)
    } catch {
      toast.error('Failed to load organization users')
    }
  }

  useEffect(() => {
    loadMembers()
  }, [orgId, projectId])

  const members = useMemo(() => {
    const userMap = new Map(orgUsers.map((u) => [u.id, u]))
    return roles.map((role): TProjectMember => {
      const user = userMap.get(role.userId)
      return {
        userId: role.userId,
        role: (role.type || 'member') as TRoleType,
        displayName:
          user?.displayName ||
          `${user?.first || ''} ${user?.last || ''}`.trim() ||
          undefined,
        email: user?.email,
      }
    })
  }, [roles, orgUsers])

  const memberUserIds = useMemo(() => new Set(roles.map((r) => r.userId)), [roles])

  const availableUsers = useMemo(
    () => orgUsers.filter((u) => !memberUserIds.has(u.id)),
    [orgUsers, memberUserIds]
  )

  const filteredMembers = searchQuery.trim()
    ? members.filter(
        (m) =>
          m.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : members

  const onOpenAdd = async () => {
    await loadOrgUsers()
    setAddDrawerOpen(true)
  }

  const onAdd = async () => {
    if (!orgId || !projectId || !selectedUserId) return
    setLoading(true)
    try {
      await projectMembersApi.add(orgId, projectId, {
        userId: selectedUserId,
        type: selectedRole,
      })
      toast.success('Member added successfully')
      setAddDrawerOpen(false)
      setSelectedUserId(null)
      setSelectedRole('member')
      await loadMembers()
    } catch (err) {
      toast.error('Failed to add member')
    } finally {
      setLoading(false)
    }
  }

  const onRemoveClick = (member: TProjectMember) => {
    setMemberToRemove(member)
    setDeleteDialogOpen(true)
  }

  const onRemoveConfirm = async () => {
    if (!orgId || !projectId || !memberToRemove) return
    setLoading(true)
    try {
      await projectMembersApi.remove(orgId, projectId, memberToRemove.userId)
      toast.success('Member removed successfully')
      setDeleteDialogOpen(false)
      setMemberToRemove(null)
      await loadMembers()
    } catch (err) {
      toast.error('Failed to remove member')
    } finally {
      setLoading(false)
    }
  }

  if (!orgId || !projectId) return null

  const columns: TDataTableColumn<TProjectMember>[] = [
    {
      id: 'name',
      label: 'Name',
      render: (member) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box>
            <Typography
              variant='body2'
              fontWeight='medium'
            >
              {member.displayName || 'Unknown'}
            </Typography>
            <Typography
              variant='caption'
              color='text.secondary'
            >
              {member.email || member.userId}
            </Typography>
          </Box>
        </Box>
      ),
    },
    {
      id: 'role',
      label: 'Role',
      render: (member) => (
        <Chip
          label={member.role || 'member'}
          size='small'
          color={getRoleColor(member.role)}
          variant='outlined'
        />
      ),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      render: (member) => (
        <ActionIconButton
          tooltip='Remove member'
          icon={<DeleteIcon fontSize='small' />}
          size='small'
          color='error'
          onClick={(e) => {
            e.stopPropagation()
            onRemoveClick(member)
          }}
        />
      ),
    },
  ]

  return (
    <Page className='tdsk-project-members-page'>
      <PageLayout
        title='Project Members'
        countLabel='member'
        count={members.length}
        loading={loading}
        query={searchQuery}
        setSearchQuery={setSearchQuery}
        searchPlaceholder='Search members by name or email...'
        searchCount={0}
        onAction={onOpenAdd}
        actionLabel='Add Member'
        actionIcon={<PersonAddIcon />}
      >
        {members.length === 0 && !loading && (
          <EmptyState
            actionIcon={<PersonAddIcon />}
            onAction={onOpenAdd}
            actionLabel='Add Member'
            message='No members yet. Add org members to this project.'
          />
        )}

        {members.length > 0 && filteredMembers.length === 0 && (
          <EmptyState message='No members match your search criteria.' />
        )}

        {filteredMembers.length > 0 && (
          <DataTable
            columns={columns}
            data={filteredMembers}
            getRowKey={(member) => member.userId}
          />
        )}

        <Drawer
          open={addDrawerOpen}
          onClose={() => setAddDrawerOpen(false)}
          title='Add Project Member'
          actions={
            <DrawerActions
              form='add-member-form'
              actions={{
                save: { onClick: onAdd, text: 'Add Member' },
                cancel: { onClick: () => setAddDrawerOpen(false) },
              }}
              loading={loading}
              disabled={loading || !selectedUserId}
            />
          }
        >
          <Box sx={{ p: 2 }}>
            <Typography
              variant='body2'
              color='text.secondary'
              sx={{ mb: 2 }}
            >
              Select an organization member to add to this project.
            </Typography>
            <Autocomplete
              value={selectedUserId}
              options={availableUsers.map((u) => u.id)}
              getOptionLabel={(id) => {
                const user = availableUsers.find((u) => u.id === id)
                return user ? `${user.displayName || user.email}` : id
              }}
              onChange={(_, value) => setSelectedUserId(value)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Select User'
                  size='small'
                />
              )}
              sx={{ mb: 2 }}
            />
            <Autocomplete
              value={selectedRole}
              options={['viewer', 'member', 'admin']}
              onChange={(_, value) => setSelectedRole(value || 'member')}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label='Role'
                  size='small'
                />
              )}
              disableClearable
            />
          </Box>
        </Drawer>

        <ConfirmDelete
          open={deleteDialogOpen}
          itemName={memberToRemove?.displayName || 'Member'}
          onCancel={() => {
            setDeleteDialogOpen(false)
            setMemberToRemove(null)
          }}
          onConfirm={onRemoveConfirm}
          warnText='This will remove the user from this project.'
        />
      </PageLayout>
    </Page>
  )
}

export default ProjectMembers
