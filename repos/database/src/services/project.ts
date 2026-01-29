import type { TDatabase, TDBProjectSelect, TDBProjectInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { projects } from '@TDB/schemas/projects'
import { Project as ProjectModel } from '@tdsk/domain'

export type TProjectOpts = {
  db: TDatabase
}

export class Project extends Base<
  typeof projects,
  TDBProjectSelect,
  TDBProjectInsert,
  ProjectModel
> {
  constructor(opts: TProjectOpts) {
    super({ ...opts, table: projects })
  }

  model = (data: TDBProjectSelect) => new ProjectModel(data)
}
