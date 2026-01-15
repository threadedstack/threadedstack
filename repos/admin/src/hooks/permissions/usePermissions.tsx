import { useMemo } from 'react'
import {
  useUser,
  useActiveOrg,
  useActiveOrgRole,
  useActiveProject,
} from '@TAF/state/selectors'
import {
  ERoleType,
  canPerform,
  hasMinRole,
  isSuperAdmin,
  EPermAction,
  EPermResource,
  canManageRole,
  canAccessSecretValue,
} from '@tdsk/domain'

export type TUsePermissions = {
  // Current user's role in active context
  role: ERoleType
  orgId?: string
  projectId?: string

  // Role checks
  isSuper: boolean
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  isViewer: boolean

  // Permission checks
  canCreate: (resource: EPermResource) => boolean
  canRead: (resource: EPermResource) => boolean
  canUpdate: (resource: EPermResource) => boolean
  canDelete: (resource: EPermResource) => boolean
  canManage: (resource: EPermResource) => boolean

  // Specific checks
  canAccessSecretValues: boolean
  canManageMembers: boolean
  canManageApiKeys: boolean
  canDeleteOrg: boolean
  canInviteUsers: boolean

  // Role management
  canAssignRole: (targetRole: ERoleType) => boolean
}

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrg] = useActiveOrg()
  const [activeProject] = useActiveProject()
  const [activeOrgRole] = useActiveOrgRole()

  // Get user's role in the current context
  // This should come from the activeOrgRole state which is set when an org is selected
  const role = useMemo(() => {
    // If user has a global super role, use that
    if (user?.role === `super`) return ERoleType.super
    // Otherwise use the org-specific role
    return (activeOrgRole as ERoleType) || ERoleType.viewer
  }, [user?.role, activeOrgRole])

  const permissions = useMemo((): TUsePermissions => {
    const isSuper = isSuperAdmin(role)
    const isOwner = hasMinRole(role, ERoleType.owner)
    const isAdmin = hasMinRole(role, ERoleType.admin)
    const isMember = hasMinRole(role, ERoleType.member)
    const isViewer = hasMinRole(role, ERoleType.viewer)

    return {
      role,
      orgId: activeOrg?.id,
      projectId: activeProject?.id,

      // Role checks
      isSuper,
      isOwner,
      isAdmin,
      isMember,
      isViewer,

      // Permission checks
      canCreate: (resource) => canPerform(role, EPermAction.create, resource).allowed,
      canRead: (resource) => canPerform(role, EPermAction.read, resource).allowed,
      canUpdate: (resource) => canPerform(role, EPermAction.update, resource).allowed,
      canDelete: (resource) => canPerform(role, EPermAction.delete, resource).allowed,
      canManage: (resource) => canPerform(role, EPermAction.manage, resource).allowed,

      // Specific checks
      canAccessSecretValues: canAccessSecretValue(role),
      canManageMembers: canPerform(role, EPermAction.manage, EPermResource.org).allowed,
      canManageApiKeys: canPerform(role, EPermAction.create, EPermResource.apiKey)
        .allowed,
      canDeleteOrg: canPerform(role, EPermAction.delete, EPermResource.org).allowed,
      canInviteUsers: canPerform(role, EPermAction.create, EPermResource.user).allowed,

      // Role management
      canAssignRole: (targetRole) => canManageRole(role, targetRole),
    }
  }, [role, activeOrg?.id, activeProject?.id])

  return permissions
}
