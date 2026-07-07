import type { TAnyObj } from '@TDM/types'

import { Base } from '@TDM/models/base'

/**
 * Record model — a JSON document (`data`) belonging to a Collection, scoped to
 * a project. `projectId` is denormalized from the collection for fast scoping.
 */
export class Record extends Base {
  collectionId!: string
  projectId!: string
  data: TAnyObj = {}

  constructor(record: Partial<Record>) {
    super()
    Object.assign(this, record)
  }
}
