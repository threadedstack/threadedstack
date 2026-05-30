import type { TRoleType, TPermission } from '@tdsk/domain'
import type { TDataTableColumn } from '@TAF/components'

import { toast } from 'sonner'
import { Page } from '@TAF/pages/Page/Page'
import { listOrgUsers } from '@TAF/actions/users'
import { isEmail } from '@keg-hub/jsutils/isEmail'
import { ProjectRoles } from '@TAF/constants/values'
import { useState, useEffect, useMemo } from 'react'
import { getRoleColor } from '@TAF/utils/user/getRoleColor'
import { UserSelectorSingle } from '@TAF/components/Selectors'
import { DataTable } from '@TAF/components/DataTable/DataTable'
import { PageLayout } from '@TAF/components/PageLayout/PageLayout'
import { EmptyState } from '@TAF/components/EmptyState/EmptyState'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'
import { PermissionsPicker } from '@TAF/components/Permissions/PermissionsPicker'
import { ActionIconButton } from '@TAF/components/ActionIconButton/ActionIconButton'
import {
  ERoleType,
  EPermScope,
  EPermResource,
  buildScopedPermissions,
} from '@tdsk/domain'
import {
  Drawer,
  TextInput,
  SelectInput,
  DrawerActions,
  ConfirmDelete,
} from '@tdsk/components'
import {
  Delete as DeleteIcon,
  PersonAdd as PersonAddIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
} from '@mui/icons-material'
import {
  Box,
  Chip,
  Button,
  Tooltip,
  Divider,
  Typography,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material'
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
  const { canInviteUsers, canManage } = usePermissions()

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
  const [inviteMode, setInviteMode] = useState<'select' | 'invite'>('select')
  const [inviteEmail, setInviteEmail] = useState('')
  const [permOverrides, setPermOverrides] = useState<TPermission[]>([])
  const [showAdvanced, setShowAdvanced] = useState(false)

  const availablePermissions = useMemo(
    () => buildScopedPermissions(selectedRole, EPermScope.project),
    [selectedRole]
  )

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

  const resetDrawer = () => {
    setAddDrawerOpen(false)
    setSelectedUserId(null)
    setSelectedRole(ERoleType.member)
    setInviteMode('select')
    setInviteEmail('')
    setPermOverrides([])
    setShowAdvanced(false)
  }

  const onAdd = async () => {
    if (!orgId || !projectId) return

    if (inviteMode === 'select' && !selectedUserId) return
    if (inviteMode === 'invite') {
      if (!inviteEmail.trim() || !isEmail(inviteEmail)) {
        toast.error(`Please enter a valid email address`)
        return
      }
    }

    setLoading(true)
    const result = await addProjectMember({
      orgId,
      projectId,
      roleType: selectedRole,
      ...(inviteMode === 'select'
        ? { userId: selectedUserId! }
        : { email: inviteEmail.trim() }),
      ...(permOverrides.length && {
        permissionOverrides: permOverrides.map((p) => ({
          permission: p,
          effect: 'grant' as const,
        })),
      }),
    })
    setLoading(false)

    if (result?.error) {
      toast.error(result.error.message || `Failed to add member`)
      return
    }

    const warnings = (result?.data as any)?.warnings as string[] | undefined
    if (warnings?.length)
      toast.warning(
        `${inviteMode === 'invite' ? 'Invitation sent' : 'Member added'}, but: ${warnings.join('; ')}`
      )
    else
      toast.success(
        inviteMode === 'invite' ? `Invitation sent` : `Member added successfully`
      )

    resetDrawer()
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
    } catch (err: any) {
      toast.error(err?.message || `Failed to remove member`)
    } finally {
      setLoading(false)
    }
  }

  if (!orgId || !projectId) return null

  const canSubmit =
    inviteMode === `select`
      ? !loading && !!selectedUserId
      : !loading && !!inviteEmail.trim()

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
          disabled={!canManage(EPermResource.project)}
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
        actionDisabled={!canManage(EPermResource.project)}
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
          onClose={resetDrawer}
          title='Add Project Member'
          actions={
            <DrawerActions
              form='add-member-form'
              actions={{
                save: {
                  onClick: onAdd,
                  text: inviteMode === 'invite' ? 'Send Invite' : 'Add Member',
                },
                cancel: { onClick: resetDrawer },
              }}
              loading={loading}
              disabled={!canSubmit}
            />
          }
        >
          <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ToggleButtonGroup
              exclusive
              fullWidth
              size='small'
              value={inviteMode}
              onChange={(_, val) => val && setInviteMode(val)}
            >
              <ToggleButton value='select'>Existing Member</ToggleButton>
              <Tooltip
                title={!canInviteUsers ? 'Requires org-level invitation permissions' : ''}
              >
                <span style={{ flex: 1 }}>
                  <ToggleButton
                    value='invite'
                    disabled={!canInviteUsers}
                    sx={{ width: '100%' }}
                  >
                    Invite by Email
                  </ToggleButton>
                </span>
              </Tooltip>
            </ToggleButtonGroup>

            {inviteMode === 'select' ? (
              <>
                <Typography
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
              </>
            ) : (
              <>
                <Typography
                  variant='body2'
                  color='text.secondary'
                >
                  Invite a new user by email. They will be added to the organization and
                  this project.
                </Typography>
                <TextInput
                  required
                  fullWidth
                  type='email'
                  value={inviteEmail}
                  id='invite-email'
                  disabled={loading}
                  label='Email Address'
                  placeholder='user@example.com'
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </>
            )}

            <SelectInput
              label='Role'
              id='member-role'
              items={ProjectRoles}
              value={selectedRole}
              onChange={(e) =>
                setSelectedRole((e.target.value as ERoleType) || ERoleType.member)
              }
            />

            <Divider />

            <Box>
              <Button
                size='small'
                onClick={() => setShowAdvanced(!showAdvanced)}
                endIcon={showAdvanced ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              >
                Granular Permissions
              </Button>
              {showAdvanced && (
                <PermissionsPicker
                  selected={permOverrides}
                  available={availablePermissions}
                  onChange={setPermOverrides}
                  disabled={loading}
                />
              )}
            </Box>
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
