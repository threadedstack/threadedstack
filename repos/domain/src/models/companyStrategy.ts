import type { TActiveInitiative, TStrategyBacklogItem } from '@TDM/types'

import { Base } from '@TDM/models/base'

export class CompanyStrategy extends Base {
  orgId!: string
  northStar: string | null = null
  segments: string[] = []
  positioning: string | null = null
  backlog: TStrategyBacklogItem[] = []
  activeInitiative: TActiveInitiative | null = null
  updatedByAgentId: string | null = null

  constructor(strategy: Partial<CompanyStrategy>) {
    super()
    Object.assign(this, strategy)
  }
}
