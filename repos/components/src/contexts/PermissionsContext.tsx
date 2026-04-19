import type { ERoleType } from '@tdsk/domain'
import { createContext } from 'react'

type TPermissionsContext = {
  role: ERoleType | null
}

export const PermissionsContext = createContext<TPermissionsContext>({ role: null })
