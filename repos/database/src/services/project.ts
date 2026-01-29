import type { TServiceOpts, TDBProjectSelect, TDBProjectInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { projects } from '@TDB/schemas/projects'
import { Project as ProjectModel } from '@tdsk/domain'

export class Project extends Base<
  typeof projects,
  TDBProjectSelect,
  TDBProjectInsert,
  ProjectModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: projects })
  }

  model = (data: TDBProjectSelect) => new ProjectModel(data)
}
