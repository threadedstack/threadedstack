import type { ComponentType } from 'react'

import { Suspense } from 'react'
import { ERoutePath } from '@TAF/types'
import { Navigate } from 'react-router'
import { Loading } from '@tdsk/components'
import type { ERoleType } from '@tdsk/domain'
import { hasMinRole } from '@tdsk/domain'
import { usePermissions } from '@TAF/hooks/permissions/usePermissions'

export type TRequireRole = {
  minRole: ERoleType
  Component: ComponentType
}

/**
 * Route guard that redirects users who lack the required minimum role.
 * Fails closed: shows a loading state when role is not yet loaded.
 * Redirects to home when role is resolved but insufficient.
 */
export const RequireRole = (props: TRequireRole) => {
  const { minRole, Component } = props

  const { role } = usePermissions()

  if (role === null)
    return (
      <Loading
        fixed
        full
      />
    )
  if (!hasMinRole(role, minRole))
    return (
      <Navigate
        to={ERoutePath.Home}
        replace
      />
    )

  return (
    <Suspense
      fallback={
        <Loading
          fixed
          full
        />
      }
    >
      <Component />
    </Suspense>
  )
}
