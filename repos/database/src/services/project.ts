import type { TProviderInput, TProviderLink } from '@tdsk/domain'
import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBProjectSelect,
  TDBProjectInsert,
  TDBProviderSelect,
} from '@TDB/types'

import { eq, count, and, sql, notInArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { logger } from '@TDB/utils/logger'
import { projects } from '@TDB/schemas/projects'
import { endpoints } from '@TDB/schemas/endpoints'
import { functions } from '@TDB/schemas/functions'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { projectProviders } from '@TDB/schemas/projectProviders'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'
import { Project as ProjectModel, Provider as ProviderModel } from '@tdsk/domain'

type TProjectSelectOpts = TDBProjectSelect & {
  providerLinks?: {
    priority: number
    projectId: string
    providerId: string
    provider: TDBProviderSelect
  }[]
}

type TProjectProviderMeta = {
  providerInputs?: TProviderInput[]
}

export type TProjectInsertOpts = TDBProjectInsert & TProjectProviderMeta

export class Project extends Base<
  typeof projects,
  TProjectSelectOpts,
  TDBProjectInsert,
  ProjectModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: projects })
  }

  with = (opts?: TDBWithRecord) => {
    return {
      ...opts,
      providerLinks: {
        with: {
          provider: true,
        },
      },
    } as TDBWithRecord
  }

  model = (data: TProjectSelectOpts) => {
    const { providerLinks: rawLinks, ...rest } = data

    return new ProjectModel({
      ...rest,
      providerLinks: (rawLinks || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          model: null,
          projectId: null,
          priority: link.priority ?? 0,
          provider: new ProviderModel(link.provider as Partial<ProviderModel>),
        })) as TProviderLink[],
    })
  }

  async get(id: string, opts?: TDBQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return {}

      return { data: this.model(row as TProjectSelectOpts) }
    } catch (error: any) {
      return { error }
    }
  }

  async list(opts: TDBQueryOpts = {}) {
    const { where, limit, offset, orderBy } = opts

    try {
      const found = await this.db.query[this.name].findMany({
        limit,
        offset,
        with: this.with(opts?.with),
        orderBy: orderBy ? addOrderBy(this.table, opts) : undefined,
        where: where ? and(...addWhere(this.table, opts)) : undefined,
      })

      if (!found?.length) return { data: [] as ProjectModel[] }

      return {
        data: found.map((row) => this.model(row as TProjectSelectOpts)) as ProjectModel[],
      }
    } catch (error: any) {
      return { error }
    }
  }

  async create(data: TProjectInsertOpts) {
    const { providerInputs, ...insertData } = data

    const result = await super.create(insertData as TDBProjectInsert)
    if (result.error || !result.data) return result

    if (providerInputs?.length) {
      try {
        await this.#upsertProviders(result.data.id, providerInputs)
        return this.get(result.data.id)
      } catch (error: any) {
        await this.db
          .delete(projects)
          .where(eq(projects.id, result.data.id))
          .catch((cleanupErr) => {
            logger.error(
              `Failed to cleanup project ${result.data!.id} after provider error`,
              { error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr }
            )
          })
        return { error }
      }
    }

    return result
  }

  async update(data: Partial<TDBProjectInsert> & TProjectProviderMeta & { id: string }) {
    const { id, providerInputs, ...updateData } = data

    try {
      if (providerInputs !== undefined) {
        await this.#upsertProviders(id, providerInputs)
      }

      const hasFields = Object.keys(updateData).length > 0
      if (hasFields) {
        const result = await super.update({ id, ...updateData } as any)
        if (result.error) return result
      }

      return this.get(id)
    } catch (error: any) {
      return { error }
    }
  }

  #upsertProviders = async (projectId: string, inputs: TProviderInput[]) => {
    if (!inputs) return

    const rows = inputs
      .filter((p) => p.id)
      .map((p, i) => ({
        providerId: p.id,
        priority: i,
        projectId,
      }))

    await this.db.transaction(async (tx) => {
      if (rows.length) {
        await tx.delete(projectProviders).where(
          and(
            eq(projectProviders.projectId, projectId),
            notInArray(
              projectProviders.providerId,
              rows.map((r) => r.providerId)
            )
          )
        )
      } else {
        await tx.delete(projectProviders).where(eq(projectProviders.projectId, projectId))
      }

      if (rows.length) {
        await tx
          .insert(projectProviders)
          .values(rows)
          .onConflictDoUpdate({
            target: [projectProviders.projectId, projectProviders.providerId],
            set: {
              priority: sql`excluded.priority`,
            },
          })
      }
    })
  }

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
