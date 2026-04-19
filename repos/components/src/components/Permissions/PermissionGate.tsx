import type { ReactNode } from 'react'
import type { TUsePermissions } from '@TSC/types'
import type { EPermAction, EPermResource, ERoleType } from '@tdsk/domain'

import { hasMinRole, canPerform } from '@tdsk/domain'
import { usePermissions } from '@TSC/hooks/permissions/usePermissions'
import { usePermissionsContext } from '@TSC/hooks/permissions/usePermissionsContext'

type TPermissionGateProps = {
  children: ReactNode
  fallback?: ReactNode
} & (
  | { action: EPermAction; resource: EPermResource }
  | { minRole: ERoleType }
  | { check: keyof TUsePermissions }
)

export const PermissionGate = (props: TPermissionGateProps) => {
  const { children, fallback = null } = props
  const { role } = usePermissionsContext()
  const permissions = usePermissions(role)

  const hasPermission = (() => {
    if (`action` in props && `resource` in props) {
      return canPerform(role, props.action, props.resource).allowed
    }
    if (`minRole` in props) {
      return hasMinRole(role, props.minRole)
    }
    if (`check` in props) {
      const value = permissions[props.check]
      return typeof value === `boolean` ? value : Boolean(value)
    }
    return false
  })()

  return hasPermission ? <>{children}</> : <>{fallback}</>
}
