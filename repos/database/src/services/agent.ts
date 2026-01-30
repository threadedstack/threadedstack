import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBAgentSelect,
  TDBAgentInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { agents } from '@TDB/schemas/agents'
import { isStr, isObj } from '@keg-hub/jsutils'
import { Agent as AgentModel } from '@tdsk/domain'

/**
 * Extended query options for Agent service
 */
export type TAgentQueryOpts = TDBQueryOpts & {
  sanitize?: boolean // Whether to sanitize secret values (default: true)
}

/**
 * Agent service for managing AI agents
 * Automatically loads and sanitizes secrets when fetching agents
 */
export class Agent extends Base<
  typeof agents,
  TDBAgentSelect,
  TDBAgentInsert,
  AgentModel
> {
  sanitize: boolean = true // Default to sanitizing secrets

  constructor(opts: TServiceOpts) {
    super({ ...opts, table: agents })
  }

  /**
   * Model factory that creates Agent instances with optional sanitization
   * Checks a custom sanitize flag on the data object
   */
  model = (data: TDBAgentSelect, sanitizeOpts?: { sanitize?: boolean }) => {
    const agent = new AgentModel(data as Partial<AgentModel>)

    // If sanitize is not explicitly false, sanitize the secrets
    const shouldSanitize = sanitizeOpts?.sanitize !== false

    if (shouldSanitize && agent.secrets)
      agent.secrets = agent.secrets.map((secret) => secret.sanitize())

    return agent
  }

  /**
   * Get a single agent with secrets data
   * Supports optional sanitization via opts.sanitize
   */
  async get(id: string, opts?: TAgentQueryOpts) {
    const result = await super.get(id, { with: { secrets: true } })

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
    const result = await super.by(data, { with: { secrets: true } })

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
    // Always include secrets
    const result = await super.list({
      ...opts,
      with: { secrets: true },
    })

    // Apply sanitization to all agents
    if (result.data && result.data.length > 0) {
      const sanitize = opts?.sanitize !== false ? true : opts?.sanitize
      result.data = result.data.map((agent) =>
        this.model(agent as TDBAgentSelect, { sanitize })
      ) as AgentModel[]
    }

    return result
  }
}
