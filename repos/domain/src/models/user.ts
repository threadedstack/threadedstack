import { Base } from './base'
import type { TRoleType } from '@TDM/types'

export class User extends Base {
  first: string
  last: string
  image: string
  name?: string
  email?: string
  banned?: boolean
  provider?: string
  banReason?: string
  emailVerified?: boolean
  role?: TRoleType | string
  banExpires?: string | Date

  constructor(usr: Partial<User>) {
    super()
    const { name } = usr
    let last = usr.last
    let first = usr.first
    if ((name && !first) || (name && !last)) {
      const [fn, ln] = name.split(` `)
      first = first || fn
      last = last || ln
    }

    Object.assign(this, { ...usr, first, last })
  }

  get displayName(): string {
    return this.name || `${this.first} ${this.last}`.trim()
  }
}
