import { Base } from './base'

export class Role extends Base {
  name: string
  type: string
  userId: string
  orgId?: string
  repoId?: string

  constructor(role: Partial<Role>) {
    super()
    Object.assign(this, role)
  }
}
