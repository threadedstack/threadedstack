import type { PermissionOverride } from '@tdsk/domain'
import { atomWithReset } from 'jotai/utils'

export const permissionOverridesState = atomWithReset<PermissionOverride[] | undefined>(
  undefined
)
