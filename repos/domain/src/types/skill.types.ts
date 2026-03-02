/**
 * Skill type definitions for the agent skills system.
 * Skills are reusable capability definitions that can be attached to agents
 * to dynamically extend their system prompt and available tools.
 */

/**
 * Skill definition — stored in DB, attached to agents via agentSkills junction.
 */
export type TAgentSkill = {
  id: string
  name: string
  description: string
  triggerKeywords?: string[]
  instructions: string
  tools?: string[]
  alwaysActive: boolean
  orgId: string
  createdAt?: string | Date
  updatedAt?: string | Date
}
