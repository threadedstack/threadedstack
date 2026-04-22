import type {
  TProviderLink,
  TProviderInput,
  TKubeSandboxConfig,
  TSandboxProjectConfig,
  Project as ProjectModel,
} from '@tdsk/domain'
import type {
  TDBUpdate,
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBSandboxSelect,
  TDBSandboxInsert,
  TDBProjectSelect,
  TDBProviderSelect,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { logger } from '@TDB/utils/logger'
import { DBError } from '@TDB/utils/error/error'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { eq, and, sql, notInArray } from 'drizzle-orm'
import { sandboxProjects } from '@TDB/schemas/sandboxProjects'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'
import { Sandbox as SandboxModel, Provider as ProviderModel } from '@tdsk/domain'

export type TSandboxSelectOpts = TDBSandboxSelect & {
  projects?: {
    sandboxId: string
    projectId: string
    alias?: string | null
    enabled?: boolean
    config?: Partial<TKubeSandboxConfig> | null
    project: ProjectModel | TDBProjectSelect
  }[]
  providers?: {
    priority: number
    sandboxId: string
    providerId: string
    model?: string | null
    provider: TDBProviderSelect
  }[]
}

type TSandboxProviderMeta = {
  providerLinks?: TProviderLink[]
  providerInputs?: TProviderInput[]
}

export type TSandboxInsertOpts = TDBSandboxInsert &
  TSandboxProviderMeta & {
    projects?: Array<
      Partial<ProjectModel> & {
        alias?: string | null
        enabled?: boolean
        config?: Partial<TKubeSandboxConfig> | null
      }
    >
  }

type TSandboxRelations = {
  id: string
  providerInputs?: TProviderInput[]
  projects?: Array<
    Partial<ProjectModel> & {
      alias?: string | null
      enabled?: boolean
      config?: Partial<TKubeSandboxConfig> | null
    }
  >
}

export class Sandbox extends Base<
  typeof sandboxes,
  TSandboxSelectOpts,
  TDBSandboxInsert,
  SandboxModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: sandboxes })
  }

  with = (opts: TDBWithRecord) => {
    return {
      ...opts,
      projects: {
        with: {
          project: true,
        },
      },
      providers: {
        with: {
          provider: true,
        },
      },
    } as TDBWithRecord
  }

  model = (data: TSandboxSelectOpts) => {
    const { providers, projects: projectLinksRaw, ...rest } = data

    const projectLinks = projectLinksRaw || []

    return new SandboxModel({
      ...rest,
      projects: projectLinks.map((link) => link.project),
      projectConfigs: projectLinks.map((link) => ({
        sandboxId: link.sandboxId,
        projectId: link.projectId,
        alias: link.alias ?? null,
        config: link.config ?? null,
        enabled: link.enabled ?? true,
      })) as TSandboxProjectConfig[],
      providerLinks: (providers || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          model: link.model ?? null,
          priority: link.priority ?? 0,
          provider: new ProviderModel(link.provider as Partial<ProviderModel>),
        })),
    })
  }

  #relations = async (opts: TSandboxRelations) => {
    const { id, projects, providerInputs } = opts

    if (projects?.length) {
      const valid = projects.filter((p) => p?.id)
      if (valid.length < projects.length)
        logger.warn(
          `[Sandbox] #relations: ${projects.length - valid.length} projects dropped (missing id) for sandbox ${id}`
        )

      const rows = valid.map((proj) => ({
        sandboxId: id,
        projectId: proj.id!,
        ...(proj.alias !== undefined && { alias: proj.alias }),
        ...(proj.config !== undefined && { config: proj.config }),
        ...(proj.enabled !== undefined && { enabled: proj.enabled }),
      }))
      if (rows.length)
        await this.db.insert(sandboxProjects).values(rows).onConflictDoNothing()
    }

    if (providerInputs !== undefined) await this.#upsertProviders(id, providerInputs)
  }

  async get(id: string, opts?: TDBQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return { error: new DBError(`${this.title} not found`) }

      return { data: this.model(row as TSandboxSelectOpts) }
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

      if (!found?.length) return { data: [] as SandboxModel[] }

      return {
        data: found.map((row) => this.model(row as TSandboxSelectOpts)) as SandboxModel[],
      }
    } catch (error: any) {
      return { error }
    }
  }

  async create(data: TSandboxInsertOpts | (TDBSandboxInsert & Record<string, any>)) {
    const { projects, providerLinks, providerInputs, ...sandboxData } =
      data as TSandboxInsertOpts
    const result = await super.create(sandboxData as TDBSandboxInsert)

    if (result.data && (projects?.length || providerInputs?.length)) {
      try {
        await this.#relations({ id: result.data.id, projects, providerInputs })
        const updated = await this.get(result.data.id)
        result.data = updated.data
      } catch (err) {
        await this.db
          .delete(sandboxes)
          .where(eq(sandboxes.id, result.data.id))
          .catch((cleanupErr) => {
            logger.error(
              `Failed to cleanup sandbox ${result.data!.id} after relation error`,
              {
                error: cleanupErr instanceof Error ? cleanupErr.message : cleanupErr,
              }
            )
          })
        throw err
      }
    }

    return result
  }

  async update(data: TDBUpdate<TSandboxInsertOpts>) {
    const { projects, providerInputs, providerLinks, ...sandboxData } = data

    if (!sandboxData.id)
      return { data: null, error: new DBError(`Sandbox ID is required for update`) }

    const result = await super.update(sandboxData)

    if (result.data && (projects !== undefined || providerInputs !== undefined)) {
      try {
        // Projects use delete+re-insert
        if (projects !== undefined)
          await this.db
            .delete(sandboxProjects)
            .where(eq(sandboxProjects.sandboxId, sandboxData.id))

        await this.#relations({ id: sandboxData.id, projects, providerInputs })
        const updated = await this.get(sandboxData.id)
        result.data = updated.data
      } catch (error: any) {
        return { data: null, error }
      }
    }

    return result
  }

  async listByOrg(orgId: string) {
    return this.list({ where: { orgId } })
  }

  /**
   * Add a sandbox to a project
   */
  async addProject(sandboxId: string, projectId: string, alias?: string) {
    try {
      const [result] = await this.db
        .insert(sandboxProjects)
        .values({
          alias,
          sandboxId,
          projectId,
        })
        .returning()

      return { data: result, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  /**
   * Remove a sandbox from a project
   */
  async removeProject(sandboxId: string, projectId: string) {
    try {
      await this.db
        .delete(sandboxProjects)
        .where(
          and(
            eq(sandboxProjects.sandboxId, sandboxId),
            eq(sandboxProjects.projectId, projectId)
          )
        )

      return { data: null, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  /**
   * Upsert per-project config overrides for a sandbox
   * Updates the sandboxProjects row with override fields
   */
  async upsertProjectConfig(
    sandboxId: string,
    projectId: string,
    config: Partial<Omit<TSandboxProjectConfig, 'sandboxId' | 'projectId'>>
  ) {
    try {
      const [result] = await this.db
        .update(sandboxProjects)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(sandboxProjects.sandboxId, sandboxId),
            eq(sandboxProjects.projectId, projectId)
          )
        )
        .returning()

      if (!result) return { error: new DBError(`Sandbox is not linked to this project`) }

      return { data: result }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get per-project config overrides for a sandbox
   * Returns the sandboxProjects row for the given sandbox+project pair
   */
  async getProjectConfig(sandboxId: string, projectId: string) {
    try {
      const result = await this.db.query.sandboxProjects.findFirst({
        where: and(
          eq(sandboxProjects.sandboxId, sandboxId),
          eq(sandboxProjects.projectId, projectId)
        ),
      })

      if (!result) return { error: new DBError(`Sandbox is not linked to this project`) }

      return {
        data: {
          sandboxId: result.sandboxId,
          projectId: result.projectId,
          alias: result.alias ?? null,
          enabled: result.enabled ?? true,
          config: result.config ?? null,
        } as TSandboxProjectConfig,
      }
    } catch (error: any) {
      return { error }
    }
  }

  async addProvider(
    sandboxId: string,
    providerId: string,
    priority: number = 0,
    model?: string | null
  ) {
    const [result] = await this.db
      .insert(sandboxProviders)
      .values({
        sandboxId,
        priority,
        providerId,
        model: model ?? null,
      })
      .returning()

    return { data: result, error: null }
  }

  async removeProvider(sandboxId: string, providerId: string) {
    await this.db
      .delete(sandboxProviders)
      .where(
        and(
          eq(sandboxProviders.sandboxId, sandboxId),
          eq(sandboxProviders.providerId, providerId)
        )
      )

    return { data: null, error: null }
  }

  async setProviders(sandboxId: string, inputs: TProviderInput[]) {
    await this.#upsertProviders(sandboxId, inputs)
    return { data: null, error: null }
  }

  #upsertProviders = async (sandboxId: string, inputs: TProviderInput[]) => {
    if (!inputs) return

    const rows = inputs
      .filter((p) => p.id)
      .map((p, i) => ({
        providerId: p.id,
        priority: i,
        sandboxId,
        model: p.model ?? null,
      }))

    await this.db.transaction(async (tx) => {
      // Remove providers no longer in the list
      if (rows.length) {
        await tx.delete(sandboxProviders).where(
          and(
            eq(sandboxProviders.sandboxId, sandboxId),
            notInArray(
              sandboxProviders.providerId,
              rows.map((r) => r.providerId)
            )
          )
        )
      } else {
        await tx.delete(sandboxProviders).where(eq(sandboxProviders.sandboxId, sandboxId))
      }

      // Upsert: insert new, update priority/model on existing
      if (rows.length) {
        await tx
          .insert(sandboxProviders)
          .values(rows)
          .onConflictDoUpdate({
            target: [sandboxProviders.sandboxId, sandboxProviders.providerId],
            set: {
              model: sql`excluded.model`,
              priority: sql`excluded.priority`,
            },
          })
      }
    })
  }
}
