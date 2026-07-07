import type { TCollectionSchema } from '@TDM/types'

import { Base } from '@TDM/models/base'

/**
 * Collection model — a project-scoped, optionally-schema'd set of Records.
 * When `schema` is present, record writes are validated against it.
 */
export class Collection extends Base {
  projectId!: string
  name!: string
  description: string | null = null
  schema: TCollectionSchema | null = null

  constructor(collection: Partial<Collection>) {
    super()
    Object.assign(this, collection)
  }
}
