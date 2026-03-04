import type { Project as ProjectModel, TAgentProjectConfig } from '@tdsk/domain'
import type {
  TDBUpdate,
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBAgentSelect,
  TDBAgentInsert,
  TDBProjectSelect,
  TDBProviderSelect,
} from '@TDB/types'

import { eq, and, inArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { agents } from '@TDB/schemas/agents'
import { isStr, isObj } from '@keg-hub/jsutils'
import { secrets } from '@TDB/schemas/secrets'
import { exists } from '@keg-hub/jsutils/exists'
import { DBError } from '@TDB/utils/error/error'
import { Agent as AgentModel } from '@tdsk/domain'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { addWhere, addOrderBy } from '@TDB/utils/database/buildQuery'

export type TAgentInsertOpts = TDBAgentInsert & {
  secretIds?: string[]
  providerIds?: string[]
  providerModels?: Record<string, string>
  projects?: Array<
    Partial<ProjectModel> & {
      model?: string | null
      maxTokens?: number | null
      systemPrompt?: string | null
      tools?: string[] | null
      functionIds?: string[] | null
      envVars?: Record<string, string> | null
      environment?: Record<string, any> | null
      enabled?: boolean
    }
  >
}

export type TAgentSelectOpts = TDBAgentSelect & {
  projects?: {
    alias?: string
    agentId: string
    projectId: string
    enabled?: boolean
    project: ProjectModel | TDBProjectSelect
    model?: string | null
    maxTokens?: number | null
    systemPrompt?: string | null
    tools?: string[] | null
    functionIds?: string[] | null
    envVars?: Record<string, string> | null
    environment?: Record<string, any> | null
  }[]
  providers?: {
    agentId: string
    providerId: string
    priority: number
    model?: string | null
    provider: TDBProviderSelect
  }[]
}

type TAgentRelations = {
  id: string
  providerIds?: string[]
  providerModels?: Record<string, string>
  secretIds?: string[]
  projects?: Array<
    Partial<ProjectModel> & {
      enabled?: boolean
      model?: string | null
      maxTokens?: number | null
      systemPrompt?: string | null
      tools?: string[] | null
      functionIds?: string[] | null
      envVars?: Record<string, string> | null
      environment?: Record<string, any> | null
    }
  >
}

/**
 * Extended query options for Agent service
 */
export type TAgentQueryOpts = TDBQueryOpts & {
  sanitize?: boolean // Whether to sanitize secret values (default: true)
}

/**
 * Agent service for managing AI agents
 * Automatically loads and sanitizes secrets when fetching agents
 * Handles many-to-many relationship with projects via agentProjects
 * Project-level overrides are stored on the agentProjects junction table
 */
export class Agent extends Base<
  typeof agents,
  TAgentSelectOpts,
  TDBAgentInsert,
  AgentModel
> {
  sanitize: boolean = true // Default to sanitizing secrets

  constructor(opts: TServiceOpts) {
    super({ ...opts, table: agents })
  }

  with = (opts: TDBWithRecord) => {
    return {
      secrets: true,
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

  #relations = async (opts: TAgentRelations) => {
    const { id, projects, providerIds, providerModels, secretIds } = opts

    if (projects?.length) {
      const rows = projects
        .filter((p) => p?.id)
        .map((proj) => ({
          agentId: id,
          alias: proj.name,
          projectId: proj.id!,
          ...(proj.tools !== undefined && { tools: proj.tools }),
          ...(proj.model !== undefined && { model: proj.model }),
          ...(proj.envVars !== undefined && { envVars: proj.envVars }),
          ...(proj.enabled !== undefined && { enabled: proj.enabled }),
          ...(proj.maxTokens !== undefined && { maxTokens: proj.maxTokens }),
          ...(proj.functionIds !== undefined && { functionIds: proj.functionIds }),
          ...(proj.environment !== undefined && { environment: proj.environment }),
          ...(proj.systemPrompt !== undefined && { systemPrompt: proj.systemPrompt }),
        }))
      if (rows.length)
        await this.db.insert(agentProjects).values(rows).onConflictDoNothing()
    }

    if (providerIds?.length) {
      const rows = providerIds.filter(Boolean).map((providerId, i) => ({
        providerId,
        priority: i,
        agentId: id,
        model: providerModels?.[providerId] ?? null,
      }))
      if (rows.length) {
        await this.db.transaction(async (tx) => {
          await tx.delete(agentProviders).where(eq(agentProviders.agentId, id))
          await tx.insert(agentProviders).values(rows)
        })
      }
    }

    // Reassign secrets to this agent (FK pattern, not junction table)
    // Clears exclusive arc columns to satisfy the secret_scope_check constraint
    if (secretIds?.length) {
      const validIds = secretIds.filter(Boolean)
      if (validIds.length)
        await this.db
          .update(secrets)
          .set({ agentId: id, orgId: null, projectId: null, providerId: null })
          .where(inArray(secrets.id, validIds))
    }
  }

  /**
   * Model factory that creates Agent instances with optional sanitization
   * Extracts project override data from junction records into projectConfigs
   */
  model = (data: TAgentSelectOpts, sanitizeOpts?: { sanitize?: boolean }) => {
    const sortedProviders = (data.providers || []).sort(
      (a, b) => (a.priority ?? 0) - (b.priority ?? 0)
    )

    const agent = new AgentModel({
      ...data,
      projects: (data.projects || []).map((link) => link.project),
      projectConfigs: (data.projects || []).map((link) => ({
        projectId: link.projectId,
        agentId: link.agentId,
        alias: link.alias ?? null,
        model: link.model ?? null,
        tools: link.tools ?? null,
        envVars: link.envVars ?? null,
        enabled: link.enabled ?? true,
        maxTokens: link.maxTokens ?? null,
        functionIds: link.functionIds ?? null,
        environment: link.environment ?? null,
        systemPrompt: link.systemPrompt ?? null,
      })),
      providers: sortedProviders.map((link) => link.provider),
      providerModels: sortedProviders.map((link) => link.model ?? null),
      providerPriorities: sortedProviders.map((link) => link.priority ?? 0),
    })

    // If sanitize is not explicitly false, sanitize the secrets
    const shouldSanitize = sanitizeOpts?.sanitize !== false

    if (shouldSanitize && agent.secrets)
      agent.secrets = agent.secrets.map((secret) => secret.sanitize())

    return agent
  }

  /**
   * Get a single agent with secrets and projects data
   * Supports optional sanitization via opts.sanitize
   */
  async get(id: string, opts?: TAgentQueryOpts) {
    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(opts?.with),
        where: eq(this.table.id, id),
      })

      if (!row) return { error: new DBError(`${this.title} not found`) }

      const sanitize = opts?.sanitize !== false
      return { data: this.model(row as TAgentSelectOpts, { sanitize }) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get agent by property with secrets data
   * Supports optional sanitization via opts.sanitize
   */
  async by(
    prop: string | Record<string, any>,
    value?: any | TAgentQueryOpts,
    opts?: TAgentQueryOpts
  ) {
    const data = isStr(prop) ? { [prop]: value } : prop
    const normalizedOpts = isObj(value) && !opts ? (value as TAgentQueryOpts) : opts

    const property = Object.keys(data)[0]
    const propValue = isStr(prop) ? value : data[property]

    if (!exists(propValue))
      return { error: new DBError(`${this.title} value is required`) }

    try {
      const row = await this.db.query[this.name].findFirst({
        with: this.with(normalizedOpts?.with),
        where: eq(this.table[property], propValue),
      })

      if (!row) return { error: new DBError(`${this.title} not found`) }

      const sanitize = normalizedOpts?.sanitize !== false
      return { data: this.model(row as TAgentSelectOpts, { sanitize }) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * List agents with optional secrets loading and sanitization
   * Supports optional sanitization via opts.sanitize
   */
  async list(opts: TAgentQueryOpts = {}) {
    const { where, limit, offset, orderBy } = opts

    try {
      const found = await this.db.query[this.name].findMany({
        limit,
        offset,
        with: this.with(opts?.with),
        orderBy: orderBy ? addOrderBy(this.table, opts) : undefined,
        where: where ? and(...addWhere(this.table, opts)) : undefined,
      })

      if (!found?.length) return { data: [] as AgentModel[] }

      const sanitize = opts?.sanitize !== false
      return {
        data: found.map((row) =>
          this.model(row as TAgentSelectOpts, { sanitize })
        ) as AgentModel[],
      }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Create an agent and optionally associate it with projects and providers
   */
  async create(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, providerIds, providerModels, secretIds, ...agentData } = data

    // Create the agent
    const result = await super.create(agentData as TDBAgentInsert)

    if (result.data && (projects?.length || providerIds?.length || secretIds?.length)) {
      await this.#relations({
        id: result.data.id,
        projects,
        secretIds,
        providerIds,
        providerModels,
      })
      const updated = await this.get(result.data.id, opts)
      result.data = updated.data
    }

    return result
  }

  /**
   * Update an agent and manage project and provider associations
   */
  async update(data: TDBUpdate<TAgentInsertOpts>, opts?: TAgentQueryOpts) {
    const { projects, providerIds, providerModels, secretIds, ...agent } = data

    if (!agent.id)
      return { data: null, error: new DBError(`Agent ID is required for update`) }

    const result = await super.update(agent)

    if (
      result.data &&
      (projects?.length || providerIds?.length || secretIds !== undefined)
    ) {
      if (projects?.length)
        await this.db.delete(agentProjects).where(eq(agentProjects.agentId, agent.id))

      if (providerIds?.length)
        await this.db.delete(agentProviders).where(eq(agentProviders.agentId, agent.id))

      // Detach all currently agent-scoped secrets before re-attaching
      // Uses `secretIds !== undefined` (not `.length`) so passing [] detaches all
      // Must set orgId to satisfy secret_scope_check (at least one scope column non-null)
      if (secretIds !== undefined)
        await this.db
          .update(secrets)
          .set({ agentId: null, orgId: result.data.orgId })
          .where(eq(secrets.agentId, agent.id))

      await this.#relations({
        id: agent.id,
        projects,
        secretIds,
        providerIds,
        providerModels,
      })
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }

  async upsert(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, providerIds, providerModels, secretIds, ...agent } = data
    const result = await super.upsert(agent)

    if (result.data && (projects?.length || providerIds?.length || secretIds?.length)) {
      await this.#relations({
        id: agent.id,
        projects,
        secretIds,
        providerIds,
        providerModels,
      })
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }

  /**
   * Add an agent to a project
   */
  async addProject(agentId: string, projectId: string, alias?: string) {
    const [result] = await this.db
      .insert(agentProjects)
      .values({
        alias,
        agentId,
        projectId,
      })
      .returning()

    return { data: result, error: null }
  }

  /**
   * Remove an agent from a project
   */
  async removeProject(agentId: string, projectId: string) {
    await this.db
      .delete(agentProjects)
      .where(
        and(eq(agentProjects.agentId, agentId), eq(agentProjects.projectId, projectId))
      )

    return { data: null, error: null }
  }

  /**
   * Add a provider to an agent with priority ordering
   */
  async addProvider(
    agentId: string,
    providerId: string,
    priority: number = 0,
    model?: string | null
  ) {
    const [result] = await this.db
      .insert(agentProviders)
      .values({
        agentId,
        priority,
        providerId,
        model: model ?? null,
      })
      .returning()

    return { data: result, error: null }
  }

  /**
   * Remove a provider from an agent
   */
  async removeProvider(agentId: string, providerId: string) {
    await this.db
      .delete(agentProviders)
      .where(
        and(
          eq(agentProviders.agentId, agentId),
          eq(agentProviders.providerId, providerId)
        )
      )

    return { data: null, error: null }
  }

  /**
   * Replace all providers for an agent, setting priority by array order
   */
  async setProviders(
    agentId: string,
    providerIds: string[],
    providerModels?: Record<string, string>
  ) {
    await this.db.delete(agentProviders).where(eq(agentProviders.agentId, agentId))

    const rows = providerIds
      .map((providerId, i) =>
        providerId
          ? {
              agentId,
              providerId,
              priority: i,
              model: providerModels?.[providerId] ?? null,
            }
          : null
      )
      .filter((r): r is NonNullable<typeof r> => r !== null)

    if (rows.length)
      await this.db.insert(agentProviders).values(rows).onConflictDoNothing()

    return { data: null, error: null }
  }

  /**
   * Upsert project-level config overrides for an agent
   * Updates the agentProjects row with override fields
   */
  async upsertProjectConfig(
    agentId: string,
    projectId: string,
    config: Partial<Omit<TAgentProjectConfig, 'agentId' | 'projectId'>>
  ) {
    try {
      const [result] = await this.db
        .update(agentProjects)
        .set({
          ...config,
          updatedAt: new Date(),
        })
        .where(
          and(eq(agentProjects.agentId, agentId), eq(agentProjects.projectId, projectId))
        )
        .returning()

      if (!result) return { error: new DBError(`Agent is not linked to this project`) }

      return { data: result }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Get project-level config overrides for an agent
   * Returns the agentProjects row for the given agent+project pair
   */
  async getProjectConfig(agentId: string, projectId: string) {
    try {
      const result = await this.db.query.agentProjects.findFirst({
        where: and(
          eq(agentProjects.agentId, agentId),
          eq(agentProjects.projectId, projectId)
        ),
      })

      if (!result) return { error: new DBError(`Agent is not linked to this project`) }

      return {
        data: {
          projectId: result.projectId,
          agentId: result.agentId,
          alias: result.alias ?? null,
          model: result.model ?? null,
          maxTokens: result.maxTokens ?? null,
          systemPrompt: result.systemPrompt ?? null,
          tools: result.tools ?? null,
          functionIds: result.functionIds ?? null,
          envVars: result.envVars ?? null,
          environment: result.environment ?? null,
          enabled: result.enabled ?? true,
        } as TAgentProjectConfig,
      }
    } catch (error: any) {
      return { error }
    }
  }
}
