import type { TRoleType } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { ERoleType } from '@tdsk/domain'
import { Page } from '@TAF/pages/Page/Page'
import { AuthRoles } from '@TAF/constants/values'
import { listOrgUsers } from '@TAF/actions/users'
import { useState, useEffect, useMemo } from 'react'
import { Box, Chip, Typography } from '@mui/material'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
import { UserSelectorSingle } from '@TAF/components/Selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import { PersonAdd as PersonAddIcon, Delete as DeleteIcon } from '@mui/icons-material'
import { Drawer, SelectInput, DrawerActions, ConfirmDelete } from '@tdsk/components'
import {
  useOrgUsers,
  useActiveOrgId,
  useActiveProjectId,
  useActiveProjectMembers,
} from '@TAF/state/selectors'
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

export const ProjectMembers = () => {
  const [orgId] = useActiveOrgId()
  const [orgUsersMap] = useOrgUsers()
  const [projectId] = useActiveProjectId()
  const [loading, setLoading] = useState(false)
  const [projectMembersMap] = useActiveProjectMembers()

  const orgUsers = useMemo(() => orgUsersMap?.[orgId] || [], [orgUsersMap, orgId])

  const roles = useMemo(
    () => (projectMembersMap ? Object.values(projectMembersMap) : []),
    [projectMembersMap]
  )
  const [searchQuery, setSearchQuery] = useState('')
  const [addDrawerOpen, setAddDrawerOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<ERoleType>(ERoleType.member)
  const [memberToRemove, setMemberToRemove] = useState<TProjectMember | null>(null)

  const loadMembers = async () => {
    if (!orgId || !projectId) return
    setLoading(true)
    try {
      await listProjectMembers({ orgId, projectId })
    } finally {
      setLoading(false)
    }
  }

  const loadOrgUsersData = async () => {
    if (!orgId) return
    try {
      await listOrgUsers(orgId)
    } catch {
      toast.error(`Failed to load organization users`)
    }
  }

  useEffect(() => {
    loadMembers()
  }, [orgId, projectId])

  const members = useMemo(() => {
    return roles.map(
      (role): TProjectMember => ({
        userId: role.userId,
        role: (role.type || 'member') as TRoleType,
        displayName:
          role.user?.name ||
          [role.user?.first, role.user?.last].filter(Boolean).join(' ') ||
          undefined,
        email: role.user?.email,
      })
    )
  }, [roles])

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
        roleType: selectedRole,
        userId: selectedUserId,
      })
      toast.success(`Member added successfully`)
      setAddDrawerOpen(false)
      setSelectedUserId(null)
      setSelectedRole(ERoleType.member)
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
            <SelectInput
              label='Role'
              id='member-role'
              items={AuthRoles}
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole((e.target.value as ERoleType) || ERoleType.member)
              }
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
