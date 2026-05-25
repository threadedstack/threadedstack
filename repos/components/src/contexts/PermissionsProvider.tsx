import type { ReactNode } from 'react'
import type { ERoleType, PermissionOverride } from '@tdsk/domain'

import { useMemo } from 'react'
import { MemoChildren } from '@TSC/components/MemoChildren'
import { PermissionsContext } from '@TSC/contexts/PermissionsContext'

export type TPermissionsProvider = {
  children: ReactNode
  role: ERoleType | null
  overrides?: PermissionOverride[]
}

export const PermissionsProvider = (props: TPermissionsProvider) => {
  const { role, overrides, children } = props
  const value = useMemo(() => ({ role, overrides }), [role, overrides])
  return (
    <PermissionsContext.Provider value={value}>
      <MemoChildren>{children}</MemoChildren>
    </PermissionsContext.Provider>
  )
}
