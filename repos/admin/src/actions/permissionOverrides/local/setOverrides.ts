import type { PermissionOverride } from '@tdsk/domain'
import { setPermissionOverrides } from '@TAF/state/accessors'

export const setOverrides = (overrides: PermissionOverride[]) => {
  setPermissionOverrides(overrides)
}
