import { ERoleType, EPermAction, EPermResource } from '../types/permissions.types'

export const AuthHeaders = Object.freeze({
  [`user.userId`]: `X-User-Id`,
  [`user.orgId`]: `X-Org-Id`,
  [`user.role`]: `X-User-Role`,
  [`user.email`]: `X-User-Email`,
})

/**
 * Role hierarchy - higher index = more permissions
 * Each role inherits all permissions from roles below it
 */
export const RoleHierarchy: ERoleType[] = [
  ERoleType.viewer,
  ERoleType.member,
  ERoleType.admin,
  ERoleType.owner,
  ERoleType.super,
]

/**
 * Permission matrix - defines minimum role required for each action on each resource
 * Format: PermissionMatrix[resource][action] = minimumRequiredRole
 */
export const PermissionMatrix: Record<EPermResource, Record<EPermAction, ERoleType>> = {
  [EPermResource.org]: {
    [EPermAction.create]: ERoleType.member, // Any authenticated user can create orgs
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.owner,
    [EPermAction.manage]: ERoleType.admin, // Member management
  },
  [EPermResource.project]: {
    [EPermAction.create]: ERoleType.member, // Members can create projects in orgs
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member, // Members can update projects they created
    [EPermAction.delete]: ERoleType.admin, // Only admins can delete projects
    [EPermAction.manage]: ERoleType.admin, // Manage project settings/members
  },
  [EPermResource.secret]: {
    [EPermAction.create]: ERoleType.admin,
    [EPermAction.read]: ERoleType.member, // Members can see secret names (not values)
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.apiKey]: {
    [EPermAction.create]: ERoleType.admin,
    [EPermAction.read]: ERoleType.admin, // API keys are sensitive
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.endpoint]: {
    [EPermAction.create]: ERoleType.member,
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.provider]: {
    [EPermAction.create]: ERoleType.admin, // Creating providers requires admin
    [EPermAction.read]: ERoleType.member,
    [EPermAction.update]: ERoleType.admin,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.user]: {
    [EPermAction.create]: ERoleType.admin, // Invite users to org/project
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.admin, // Update other users' roles
    [EPermAction.delete]: ERoleType.owner, // Only owner can remove users
    [EPermAction.manage]: ERoleType.admin, // Manage user roles/permissions
  },
  [EPermResource.function]: {
    [EPermAction.create]: ERoleType.member,
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.config]: {
    [EPermAction.create]: ERoleType.member,
    [EPermAction.read]: ERoleType.viewer,
    [EPermAction.update]: ERoleType.member,
    [EPermAction.delete]: ERoleType.admin,
    [EPermAction.manage]: ERoleType.admin,
  },
  [EPermResource.role]: {
    [EPermAction.create]: ERoleType.admin, // Only admins can create roles
    [EPermAction.read]: ERoleType.viewer, // Anyone can see roles
    [EPermAction.update]: ERoleType.admin, // Only admins can modify roles
    [EPermAction.delete]: ERoleType.owner, // Only owner can delete roles
    [EPermAction.manage]: ERoleType.admin,
  },
}
