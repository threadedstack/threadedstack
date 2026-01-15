import type { ReactNode } from 'react'
import type { EPermAction, EPermResource, ERoleType } from '@tdsk/domain'

import { hasMinRole } from '@tdsk/domain'
import { useCanPerform } from '@TAF/hooks/permissions/useCanPerform'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

type TPermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof ReturnType<typeof usePermissions> }
)

/**
 * Conditionally render children based on user permissions
 *
 * Usage:
 * <PermissionGate action={EPermAction.create} resource={EPermResource.secret}>
 *   <CreateSecretButton />
 * </PermissionGate>
 *
 * <PermissionGate minRole={ERoleType.admin}>
 *   <AdminPanel />
 * </PermissionGate>
 *
 * <PermissionGate check="canManageMembers">
 *   <MemberManagement />
 * </PermissionGate>
 */
export const PermissionGate = (props: TPermissionGateProps) => {
  const { children, fallback = null } = props
  const permissions = usePermissions()

  let hasPermission = false

  if (`action` in props && `resource` in props) {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    hasPermission = useCanPerform(props.action, props.resource)
  } else if (`minRole` in props) {
    hasPermission = hasMinRole(permissions.role, props.minRole)
  } else if (`check` in props) {
    const value = permissions[props.check]
    hasPermission = typeof value === `boolean` ? value : Boolean(value)
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
