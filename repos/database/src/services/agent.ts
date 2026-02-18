import type { Project as ProjectModel } from '@tdsk/domain'
import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBAgentSelect,
  TDBAgentInsert,
  TDBProjectSelect,
  TDBFunctionSelect,
  TDBProviderSelect,
} from '@TDB/types'

import { eq, and } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { agents } from '@TDB/schemas/agents'
import { isStr, isObj } from '@keg-hub/jsutils'
import { DBError } from '@TDB/utils/error/error'
import { Agent as AgentModel } from '@tdsk/domain'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { agentFunctions } from '@TDB/schemas/agentFunctions'
import { agentProviders } from '@TDB/schemas/agentProviders'

export type TAgentInsertOpts = TDBAgentInsert & {
  functionIds?: string[]
  providerIds?: string[]
  projects?: Array<Partial<ProjectModel>>
}

export type TAgentSelectOpts = TDBAgentSelect & {
  projects?: {
    alias?: string
    agentId: string
    projectId: string
    project: ProjectModel | TDBProjectSelect
  }[]
  functions?: {
    agentId: string
    functionId: string
    function: TDBFunctionSelect
  }[]
  providers?: {
    agentId: string
    providerId: string
    priority: number
    provider: TDBProviderSelect
  }[]
}

type TAgentRelations = {
  id: string
  functionIds?: string[]
  providerIds?: string[]
  projects?: Array<Partial<ProjectModel>>
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
 * Handles many-to-many relationship with projects
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
      functions: {
        with: {
          function: true,
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
    const { id, projects, functionIds, providerIds } = opts

    if (projects?.length)
      for (const proj of projects) {
        if (!proj?.id) continue
        await this.db
          .insert(agentProjects)
          .values({
            agentId: id,
            alias: proj.name,
            projectId: proj.id,
          })
          .onConflictDoNothing()
      }

    if (functionIds?.length)
      for (const functionId of functionIds) {
        if (!functionId) continue
        await this.db
          .insert(agentFunctions)
          .values({
            agentId: id,
            functionId,
          })
          .onConflictDoNothing()
      }

    if (providerIds?.length)
      for (let i = 0; i < providerIds.length; i++) {
        const providerId = providerIds[i]
        if (!providerId) continue
        await this.db
          .insert(agentProviders)
          .values({
            agentId: id,
            providerId,
            priority: i,
          })
          .onConflictDoNothing()
      }
  }

  /**
   * Model factory that creates Agent instances with optional sanitization
   * Checks a custom sanitize flag on the data object
   */
  model = (data: TAgentSelectOpts, sanitizeOpts?: { sanitize?: boolean }) => {
    const agent = new AgentModel({
      ...data,
      projects: (data.projects || []).map((link) => link.project),
      functions: (data.functions || []).map((link) => link.function),
      providers: (data.providers || [])
        .sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0))
        .map((link) => link.provider),
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
    const result = await super.get(id, { ...opts, with: this.with(opts?.with) })

    // Apply sanitization if data exists
    if (result.data) {
      const sanitize = opts?.sanitize !== false ? true : opts?.sanitize
      result.data = this.model(result.data as TDBAgentSelect, { sanitize })
    }

    return result
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
    const result = await super.by(data, {
      ...normalizedOpts,
      with: this.with(normalizedOpts?.with),
    })

    // Apply sanitization if data exists
    if (result.data && normalizedOpts) {
      const sanitize =
        normalizedOpts?.sanitize !== false ? true : normalizedOpts?.sanitize
      result.data = this.model(result.data as TDBAgentSelect, { sanitize })
    }

    return result
  }

  /**
   * List agents with optional secrets loading and sanitization
   * Supports optional sanitization via opts.sanitize
   */
  async list(opts: TAgentQueryOpts = {}) {
    // Always include secrets and projects
    const result = await super.list({ ...opts, with: this.with(opts.with) })

    // Apply sanitization to all agents
    if (result.data && result.data.length > 0) {
      const sanitize = opts?.sanitize !== false ? true : opts?.sanitize
      result.data = result.data.map((agent) =>
        this.model(agent as TDBAgentSelect, { sanitize })
      ) as AgentModel[]
    }

    return result
  }

  /**
   * Create an agent and optionally associate it with projects and functions
   */
  async create(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, ...agentData } = data

    // Create the agent
    const result = await super.create(agentData as TDBAgentInsert)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length)) {
      await this.#relations({ id: result.data.id, projects, functionIds, providerIds })
      const updated = await this.get(result.data.id, opts)
      result.data = updated.data
    }

    return result
  }

  /**
   * Update an agent and manage project and function associations
   */
  async update(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, ...agent } = data

    if (!agent.id)
      return { data: null, error: new DBError(`Agent ID is required for update`) }

    const result = await super.update(agent)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length)) {
      if (projects?.length)
        await this.db.delete(agentProjects).where(eq(agentProjects.agentId, agent.id))

      if (functionIds?.length)
        await this.db.delete(agentFunctions).where(eq(agentFunctions.agentId, agent.id))

      if (providerIds?.length)
        await this.db.delete(agentProviders).where(eq(agentProviders.agentId, agent.id))

      await this.#relations({ id: agent.id, projects, functionIds, providerIds })
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }

  async upsert(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, functionIds, providerIds, ...agent } = data
    const result = await super.upsert(agent)

    if (result.data && (projects?.length || functionIds?.length || providerIds?.length)) {
      await this.#relations({ id: agent.id, projects, functionIds, providerIds })
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
   * Add a function to an agent
   */
  async addFunction(agentId: string, functionId: string) {
    const [result] = await this.db
      .insert(agentFunctions)
      .values({
        agentId,
        functionId,
      })
      .returning()

    return { data: result, error: null }
  }

  /**
   * Remove a function from an agent
   */
  async removeFunction(agentId: string, functionId: string) {
    await this.db
      .delete(agentFunctions)
      .where(
        and(
          eq(agentFunctions.agentId, agentId),
          eq(agentFunctions.functionId, functionId)
        )
      )

    return { data: null, error: null }
  }

  /**
   * Add a provider to an agent with priority ordering
   */
  async addProvider(agentId: string, providerId: string, priority: number = 0) {
    const [result] = await this.db
      .insert(agentProviders)
      .values({
        agentId,
        providerId,
        priority,
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
  async setProviders(agentId: string, providerIds: string[]) {
    await this.db.delete(agentProviders).where(eq(agentProviders.agentId, agentId))

    for (let i = 0; i < providerIds.length; i++) {
      const providerId = providerIds[i]
      if (!providerId) continue
      await this.db
        .insert(agentProviders)
        .values({
          agentId,
          providerId,
          priority: i,
        })
        .onConflictDoNothing()
    }

    return { data: null, error: null }
  }
}
