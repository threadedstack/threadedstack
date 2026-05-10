import type {
  TProviderInput,
  TGitProviderInput,
  TKubeSandboxConfig,
  TSandboxProjectConfig,
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
import { sandboxProjectProviders } from '@TDB/schemas/sandboxProjectProviders'
import {
  slugify,
  isValidSandboxAlias,
  Sandbox as SandboxModel,
  Project as ProjectModel,
  Provider as ProviderModel,
} from '@tdsk/domain'

type TProjectSBRow = {
  alias: string
  sandboxId: string
  projectId: string
  enabled?: boolean
  config?: Partial<TKubeSandboxConfig> | null
}

export type TSandboxSelectOpts = TDBSandboxSelect & {
  projects?: {
    sandboxId: string
    projectId: string
    alias: string
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
  gitProjectProviders?: {
    sandboxId: string
    projectId: string
    providerId: string
    priority: number
    branch?: string | null
    provider: TDBProviderSelect
  }[]
}

type TSandboxProviderMeta = {
  providerInputs?: TProviderInput[]
  gitProviderInputs?: Array<{ projectId: string; providers: TGitProviderInput[] }>
}

export type TSandboxInsertOpts = TDBSandboxInsert &
  TSandboxProviderMeta & {
    projects?: Array<
      Partial<ProjectModel> & {
        alias?: string
        enabled?: boolean
        config?: Partial<TKubeSandboxConfig> | null
      }
    >
  }

type TSandboxRelations = {
  id: string
  sandboxName: string
  providerInputs?: TProviderInput[]
  gitProviderInputs?: Array<{ projectId: string; providers: TGitProviderInput[] }>
  projects?: Array<
    Partial<ProjectModel> & {
      alias?: string
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
      gitProjectProviders: {
        with: {
          provider: true,
        },
      },
    } as TDBWithRecord
  }

  model = (data: TSandboxSelectOpts) => {
    const { providers, gitProjectProviders, projects: projectLinksRaw, ...rest } = data

    const projectLinks = projectLinksRaw || []

    return new SandboxModel({
      ...rest,
      projects: projectLinks.map(
        (link) => new ProjectModel(link.project as Partial<ProjectModel>)
      ),
      projectConfigs: projectLinks.map((link) => ({
        alias: link.alias,
        sandboxId: link.sandboxId,
        projectId: link.projectId,
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
      gitProviderLinks: (gitProjectProviders || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => ({
          priority: link.priority ?? 0,
          projectId: link.projectId,
          branch: link.branch ?? null,
          provider: new ProviderModel(link.provider as Partial<ProviderModel>),
        })),
    })
  }

  #generateAlias = async (sandboxName: string, projectId: string): Promise<string> => {
    const base = slugify(sandboxName) || `sandbox`

    const existing = await this.db.query.sandboxProjects.findMany({
      where: eq(sandboxProjects.projectId, projectId),
      columns: { alias: true },
    })

    const taken = new Set(existing.map((r) => r.alias))
    if (!taken.has(base)) return base

    const maxSuffix = 1000
    let suffix = 2
    while (taken.has(`${base}-${suffix}`) && suffix <= maxSuffix) suffix++
    if (suffix > maxSuffix)
      throw new DBError(`Could not generate a unique alias for "${sandboxName}"`)
    return `${base}-${suffix}`
  }

  #relations = async (opts: TSandboxRelations) => {
    const { id, projects, sandboxName, providerInputs, gitProviderInputs } = opts

    if (projects?.length) {
      const valid = projects.filter((p) => p?.id)
      if (valid.length < projects.length)
        logger.warn(
          `[Sandbox] #relations: ${projects.length - valid.length} projects dropped (missing id) for sandbox ${id}`
        )

      const rows: Array<TProjectSBRow> = []

      for (const proj of valid) {
        if (proj.alias && !isValidSandboxAlias(proj.alias))
          throw new DBError(`Invalid sandbox alias "${proj.alias}"`)
        const alias = proj.alias || (await this.#generateAlias(sandboxName, proj.id!))
        rows.push({
          alias,
          sandboxId: id,
          projectId: proj.id!,
          ...(proj.config !== undefined && { config: proj.config }),
          ...(proj.enabled !== undefined && { enabled: proj.enabled }),
        })
      }

      if (rows.length)
        await this.db
          .insert(sandboxProjects)
          .values(rows)
          .onConflictDoUpdate({
            target: [sandboxProjects.sandboxId, sandboxProjects.projectId],
            set: { alias: sql`excluded.alias` },
          })
    }

    if (providerInputs !== undefined) await this.#upsertProviders(id, providerInputs)

    if (gitProviderInputs !== undefined) {
      for (const entry of gitProviderInputs) {
        const { error } = await this.setGitProjectProviders(
          id,
          entry.projectId,
          entry.providers
        )
        if (error) throw error
      }
    }
  }

  async get(id: string, opts?: TDBQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return {}

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
    const { projects, providerInputs, gitProviderInputs, ...sandboxData } =
      data as TSandboxInsertOpts
    const result = await super.create(sandboxData as TDBSandboxInsert)

    if (
      result.data &&
      (projects?.length || providerInputs?.length || gitProviderInputs?.length)
    ) {
      try {
        await this.#relations({
          projects,
          providerInputs,
          gitProviderInputs,
          id: result.data.id,
          sandboxName: result.data.name,
        })
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
    const { projects, providerInputs, gitProviderInputs, ...sandboxData } = data

    if (!sandboxData.id)
      return { data: null, error: new DBError(`Sandbox ID is required for update`) }

    const result = await super.update(sandboxData)

    if (
      result.data &&
      (projects !== undefined ||
        providerInputs !== undefined ||
        gitProviderInputs !== undefined)
    ) {
      try {
        if (projects !== undefined)
          await this.db
            .delete(sandboxProjects)
            .where(eq(sandboxProjects.sandboxId, sandboxData.id))

        await this.#relations({
          projects,
          providerInputs,
          gitProviderInputs,
          id: sandboxData.id,
          sandboxName: result.data.name,
        })
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
      if (alias && !isValidSandboxAlias(alias))
        return { data: null, error: new DBError(`Invalid sandbox alias "${alias}"`) }

      if (!alias) {
        const { data: sandbox } = await this.get(sandboxId)
        if (!sandbox) return { data: null, error: new DBError(`Sandbox not found`) }
        alias = await this.#generateAlias(sandbox.name, projectId)
      }

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
      if (config.alias !== undefined && !isValidSandboxAlias(config.alias))
        return { error: new DBError(`Invalid sandbox alias "${config.alias}"`) }

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
          alias: result.alias,
          sandboxId: result.sandboxId,
          projectId: result.projectId,
          config: result.config ?? null,
          enabled: result.enabled ?? true,
        } as TSandboxProjectConfig,
      }
    } catch (error: any) {
      return { error }
    }
  }

  async getByProjectAlias(projectId: string, alias: string) {
    try {
      const link = await this.db.query.sandboxProjects.findFirst({
        where: and(
          eq(sandboxProjects.projectId, projectId),
          eq(sandboxProjects.alias, alias)
        ),
      })

      if (!link) return { data: null, error: new DBError(`${this.title} not found`) }

      return this.get(link.sandboxId)
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async addProvider(
    sandboxId: string,
    providerId: string,
    priority: number = 0,
    model?: string | null
  ) {
    try {
      const [result] = await this.db
        .insert(sandboxProviders)
        .values({
          sandboxId,
          priority,
          providerId,
          model: model ?? null,
        })
        .onConflictDoNothing()
        .returning()

      return { data: result ?? { sandboxId, providerId, priority }, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
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

      if (rows.length)
        await tx.insert(sandboxProviders).values(rows).onConflictDoNothing()
    })
  }

  async setGitProjectProviders(
    sandboxId: string,
    projectId: string,
    inputs: TGitProviderInput[]
  ) {
    try {
      const rows = (inputs || [])
        .filter((p) => p.id)
        .map((p, i) => ({
          sandboxId,
          projectId,
          priority: i,
          providerId: p.id,
          branch: p.branch ?? null,
        }))

      await this.db.transaction(async (tx) => {
        await tx
          .delete(sandboxProjectProviders)
          .where(
            and(
              eq(sandboxProjectProviders.sandboxId, sandboxId),
              eq(sandboxProjectProviders.projectId, projectId)
            )
          )

        if (rows.length)
          await tx.insert(sandboxProjectProviders).values(rows).onConflictDoNothing()
      })

      return { data: null, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async addGitProjectProvider(
    sandboxId: string,
    projectId: string,
    providerId: string,
    opts?: { priority?: number; branch?: string | null }
  ) {
    try {
      const [result] = await this.db
        .insert(sandboxProjectProviders)
        .values({
          sandboxId,
          projectId,
          providerId,
          priority: opts?.priority ?? 0,
          branch: opts?.branch ?? null,
        })
        .onConflictDoNothing()
        .returning()

      return { data: result ?? { sandboxId, projectId, providerId }, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }

  async removeGitProjectProvider(
    sandboxId: string,
    projectId: string,
    providerId: string
  ) {
    try {
      await this.db
        .delete(sandboxProjectProviders)
        .where(
          and(
            eq(sandboxProjectProviders.sandboxId, sandboxId),
            eq(sandboxProjectProviders.projectId, projectId),
            eq(sandboxProjectProviders.providerId, providerId)
          )
        )

      return { data: null, error: null }
    } catch (error: any) {
      return { data: null, error }
    }
  }
}
