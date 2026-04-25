import type { ReactNode } from 'react'
import type { ERoleType } from '@tdsk/domain'

import { useMemo } from 'react'
import { PermissionsContext } from '@TSC/contexts/PermissionsContext'

export type TPermissionsProvider = {
  role: ERoleType | null
  children: ReactNode
}

export const PermissionsProvider = (props: TPermissionsProvider) => {
  const { role, children } = props
  const value = useMemo(() => ({ role }), [role])
  return (
    <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
  )
}
