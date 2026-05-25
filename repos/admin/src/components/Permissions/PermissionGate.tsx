import type { ReactNode } from 'react'
import type { EPermAction, EPermResource, ERoleType, TPermission } from '@tdsk/domain'

import { hasMinRole } from '@tdsk/domain'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

type TPermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof ReturnType<typeof usePermissions> }
  | { permission: TPermission }
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
 *
 * <PermissionGate permission="sandbox:connect">
 *   <ConnectButton />
 * </PermissionGate>
 */
export const PermissionGate = (props: TPermissionGateProps) => {
  const { children, fallback = null } = props
  const permissions = usePermissions()

  let hasPermission = false

  if (`permission` in props) {
    hasPermission = permissions.has(props.permission)
  } else if (`action` in props && `resource` in props) {
    hasPermission = permissions.has(`${props.resource}:${props.action}`)
  } else if (`minRole` in props) {
    hasPermission = hasMinRole(permissions.role, props.minRole)
  } else if (`check` in props) {
    const value = permissions[props.check]
    if (typeof value === `function`) {
      hasPermission = false
    } else {
      hasPermission = typeof value === `boolean` ? value : Boolean(value)
    }
  }

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
