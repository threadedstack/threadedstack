import type { TPermission } from '@TDM/types'

import { Base } from '@TDM/models/base'

export class PermissionOverride extends Base {
  userId: string
  orgId?: string
  reason?: string
  grantedBy: string
  projectId?: string
  permission: TPermission
  effect: `grant` | `deny`
  expiresAt?: string | Date

  constructor(data: Partial<PermissionOverride>) {
    super()
    Object.assign(this, data)
  }
}
