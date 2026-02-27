import type { TServiceOpts, TDBProjectSelect, TDBProjectInsert } from '@TDB/types'

import { eq, count } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { projects } from '@TDB/schemas/projects'
import { endpoints } from '@TDB/schemas/endpoints'
import { functions } from '@TDB/schemas/functions'
import { Project as ProjectModel } from '@tdsk/domain'
import { agentProjects } from '@TDB/schemas/agentProjects'

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

  async getCounts(projectId: string) {
    const [ep, fn, ag] = await Promise.all([
      this.db
        .select({ count: count() })
        .from(endpoints)
        .where(eq(endpoints.projectId, projectId)),
      this.db
        .select({ count: count() })
        .from(functions)
        .where(eq(functions.projectId, projectId)),
      this.db
        .select({ count: count() })
        .from(agentProjects)
        .where(eq(agentProjects.projectId, projectId)),
    ])
    return {
      data: {
        agent: Number(ag[0]?.count ?? 0),
        endpoint: Number(ep[0]?.count ?? 0),
        function: Number(fn[0]?.count ?? 0),
      },
    }
  }
}
