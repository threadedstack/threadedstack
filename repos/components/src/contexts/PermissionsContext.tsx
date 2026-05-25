import type { ERoleType, PermissionOverride } from '@tdsk/domain'
import { createContext } from 'react'

type TPermissionsContext = {
  role: ERoleType | null
  overrides?: PermissionOverride[]
}

export const PermissionsContext = createContext<TPermissionsContext>({ role: null })
