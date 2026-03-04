import { Base } from './base'
import type { TRoleType } from '../types/permissions.types'

export class Organization extends Base {
  name: string
  ownerId: string
  description?: string
  /** Runtime-only — injected by listOrgs endpoint to indicate calling user's role */
  userRole?: TRoleType

  constructor(org: Partial<Organization>) {
    super()
    Object.assign(this, org)
  }
}
