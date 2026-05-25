import type { ReactNode } from 'react'
import type { TUsePermissions } from '@TSC/types'
import type { EPermAction, EPermResource, ERoleType, TPermission } from '@tdsk/domain'

import { hasMinRole } from '@tdsk/domain'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { isBool } from '@keg-hub/jsutils/isBool'
import { usePermissions } from '@TSC/hooks/permissions/usePermissions'
import { usePermissionsContext } from '@TSC/hooks/permissions/usePermissionsContext'

type TPermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof TUsePermissions }
  | { permission: TPermission }
)

const checkPermission = (
  props: TPermissionGateProps,
  permissions: TUsePermissions,
  role: ERoleType
) => {
  if (`permission` in props) return permissions.has(props.permission)
  if (`action` in props && `resource` in props)
    return permissions.has(`${props.resource}:${props.action}`)

  if (`minRole` in props) return hasMinRole(role, props.minRole)

  if (`check` in props) {
    const value = permissions[props.check]
    if (isFunc(value)) return false
    return isBool(value) ? value : Boolean(value)
  }

  return false
}

export const PermissionGate = (props: TPermissionGateProps) => {
  const { children, fallback = null } = props
  const { role, overrides } = usePermissionsContext()
  const permissions = usePermissions(role, overrides)
  const hasPermission = checkPermission(props, permissions, role)

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
