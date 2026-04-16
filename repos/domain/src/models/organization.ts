import type { TOrgConfig } from '@TDM/types/gui.types'

import { Base } from '@TDM/models/base'

export class Organization extends Base {
  name: string
  ownerId: string
  description?: string
  config?: TOrgConfig

  constructor(org: Partial<Organization>) {
    super()
    Object.assign(this, org)
  }
}
