import type { User, TRoleType, Role } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { ERoleType } from '@tdsk/domain'
import { Page } from '@TAF/pages/Page/Page'
import { ConfirmDelete } from '@tdsk/components'
import { AuthRoles } from '@TAF/constants/values'
import { listOrgUsers } from '@TAF/actions/users'
import { useState, useEffect, useMemo } from 'react'
import { Drawer, DrawerActions } from '@tdsk/components'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
import { UserSelectorSingle } from '@TAF/components/Selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { useActiveOrgId, useActiveProjectId } from '@TAF/state/selectors'
import { Box, Chip, Typography, Autocomplete, TextField } from '@mui/material'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { PersonAdd as PersonAddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import {
  addProjectMember,
  listProjectMembers,
  removeProjectMember,
} from '@TAF/actions/projectMembers'

type TProjectMember = {
  userId: string
  email?: string
  role: TRoleType
  displayName?: string
}

const AuthRoleValues = AuthRoles.map((item) => item.value)

export const ProjectMembers = () => {
  const [orgId] = useActiveOrgId()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(false)
  const [roles, setRoles] = useState<Role[]>([])
  const [orgUsers, setOrgUsers] = useState<User[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<ERoleType>(ERoleType.viewer)
  const [memberToRemove, setMemberToRemove] = useState<TProjectMember | null>(null)

  const loadMembers = async () => {
    if (!orgId || !projectId) return
    setLoading(true)
    try {
      const resp = await listProjectMembers({ orgId, projectId })
      if (resp.data) setRoles(resp.data)
    } finally {
      setLoading(false)
    }
  }

  const loadOrgUsersData = async () => {
    if (!orgId) return
    try {
      const resp = await listOrgUsers(orgId)
      if (resp.data) setOrgUsers(resp.data)
    } catch {
      toast.error(`Failed to load organization users`)
    }
  }

  useEffect(() => {
    loadMembers()
    loadOrgUsersData()
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
    await loadOrgUsersData()
    setAddDrawerOpen(true)
  }

  const onAdd = async () => {
    if (!orgId || !projectId || !selectedUserId) return
    setLoading(true)
    try {
      await addProjectMember({
        orgId,
        projectId,
        type: selectedRole,
        userId: selectedUserId,
      })
      toast.success(`Member added successfully`)
      setAddDrawerOpen(false)
      setSelectedUserId(null)
      setSelectedRole(ERoleType.viewer)
      await loadMembers()
    } catch (err) {
      toast.error(`Failed to add member`)
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
      await removeProjectMember({
        orgId,
        projectId,
        userId: memberToRemove.userId,
      })
      toast.success(`Member removed successfully`)
      setDeleteDialogOpen(false)
      setMemberToRemove(null)
      await loadMembers()
    } catch (err) {
      toast.error(`Failed to remove member`)
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
        searchCount={0}
        countLabel='member'
        loading={loading}
        query={searchQuery}
        onAction={onOpenAdd}
        count={members.length}
        title='Project Members'
        actionLabel='Add Member'
        actionIcon={<PersonAddIcon />}
        setSearchQuery={setSearchQuery}
        searchPlaceholder='Search members by name or email...'
      >
        {members.length === 0 && !loading && (
          <EmptyState
            onAction={onOpenAdd}
            actionLabel='Add Member'
            actionIcon={<PersonAddIcon />}
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
              sx={{ mb: 2 }}
              variant='body2'
              color='text.secondary'
            >
              Select an organization member to add to this project.
            </Typography>
            <UserSelectorSingle
              userId={selectedUserId}
              onChange={setSelectedUserId}
              users={availableUsers.map((u) => ({
                id: u.id,
                email: u.email,
                name: u.displayName || u.email || u.id,
              }))}
            />
            <Autocomplete
              value={selectedRole}
              options={AuthRoleValues}
              onChange={(_, value) => setSelectedRole(value || ERoleType.viewer)}
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
