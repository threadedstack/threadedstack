import { Base } from './base'

export class Organization extends Base {
  name: string
  description?: string

  constructor(org: Partial<Organization>) {
    super()
    Object.assign(this, org)
  }
}
