import type { TRoleUser } from '@TDM/types'

import { Base } from '@TDM/models/base'
import { ERoleType } from '@TDM/types'
import { hasMinRole } from '@TDM/utils/permissions'

export type TRole = Omit<Partial<Role>, `type`> & {
  type?: string | ERoleType
}

export class Role extends Base {
  name?: string
  type: ERoleType
  userId: string
  orgId?: string
  user?: TRoleUser
  projectId?: string

  constructor(role: TRole) {
    super()
    Object.assign(this, role)
    this.type = (this.type ?? ERoleType.member) as ERoleType
  }

  /**
   * Check if this role has at least the given role level
   * @param required - The minimum required role
   * @returns True if this role has sufficient permissions
   */
  hasMinRole(required: ERoleType): boolean {
    return hasMinRole(this.type, required)
  }

  /**
   * Check if this is an admin or higher role
   */
  isAdmin(): boolean {
    return hasMinRole(this.type, ERoleType.admin)
  }

  /**
   * Check if this is an owner role
   */
  isOwner(): boolean {
    return this.type === ERoleType.owner || this.type === ERoleType.super
  }

  /**
   * Check if this is a super admin role
   */
  isSuperAdmin(): boolean {
    return this.type === ERoleType.super
  }
}
