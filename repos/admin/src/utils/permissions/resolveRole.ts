import { ERoleType, isValidRoleType } from '@tdsk/domain'

/**
 * Resolve the effective permission role from user and org role state.
 * Super users get ERoleType.super regardless of org membership.
 * Invalid/unrecognized role strings return null (fail-closed).
 */
export const resolveRole = (
  userRole: string | undefined,
  activeOrgRole: string | undefined
): ERoleType | null => {
  if (userRole === `super`) return ERoleType.super
  if (!activeOrgRole) return null
  return isValidRoleType(activeOrgRole) ? activeOrgRole : null
}
