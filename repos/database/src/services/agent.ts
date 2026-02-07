import type {
  TDBWithObj,
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBAgentSelect,
  TDBAgentInsert,
  TDBProjectSelect,
} from '@TDB/types'

import { eq, and } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { agents } from '@TDB/schemas/agents'
import { isStr, isObj } from '@keg-hub/jsutils'
import { agentProjects } from '@TDB/schemas/agentProjects'
import type { Project as ProjectModel } from '@tdsk/domain'
import { Agent as AgentModel } from '@tdsk/domain'

export type TAgentInsertOpts = TDBAgentInsert & {
  projects?: Array<Partial<ProjectModel>>
}

export type TAgentSelectOpts = TDBAgentSelect & {
  projects?: {
    alias?: string
    agentId: string
    projectId: string
    project: ProjectModel | TDBProjectSelect
  }[]
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
    const proj: TDBWithObj = isObj<TDBWithObj>(opts?.projects) ? opts.projects : {}
    return {
      secrets: true,
      provider: true,
      ...opts,
      projects: {
        with: {
          project: true,
        },
      },
    }
  }

  #relations = async (id: string, projects?: Array<Partial<ProjectModel>>) => {
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
  }

  /**
   * Model factory that creates Agent instances with optional sanitization
   * Checks a custom sanitize flag on the data object
   */
  model = (data: TAgentSelectOpts, sanitizeOpts?: { sanitize?: boolean }) => {
    const agent = new AgentModel({
      ...data,
      projects: data.projects.map((link) => link.project),
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
    const result = await super.get(id, { ...opts, with: this.with(opts.with) })

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
    const result = await super.by(data, { ...opts, with: this.with(opts.with) })

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
   * Create an agent and optionally associate it with projects
   */
  async create(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, ...agentData } = data

    // Create the agent
    const result = await super.create(agentData as TDBAgentInsert)

    // If projectIds are provided, create the associations
    if (result.data && projects?.length) {
      await this.#relations(result.data.id, projects)

      const updated = await this.get(result.data.id, opts)
      result.data = updated.data
    }

    return result
  }

  /**
   * Update an agent and manage project associations
   */
  async update(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, ...agent } = data

    if (!agent.id)
      return { data: null, error: new Error('Agent ID is required for update') }

    // Update the agent
    const result = await super.update(agent)

    // If projectIds are provided, update the associations
    if (result.data && projects?.length) {
      // Delete existing project associations
      await this.db.delete(agentProjects).where(eq(agentProjects.agentId, agent.id))

      await this.#relations(agent.id, projects)

      // Fetch the agent with projects to return complete data
      const updated = await this.get(agent.id, opts)
      result.data = updated.data
    }

    return result
  }

  async upsert(data: TAgentInsertOpts, opts?: TAgentQueryOpts) {
    const { projects, ...agent } = data
    const result = await super.upsert(agent)

    // If projectIds are provided, update the associations
    if (result.data && projects?.length) {
      await this.#relations(agent.id, projects)

      // Fetch the agent with projects to return complete data
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
}
